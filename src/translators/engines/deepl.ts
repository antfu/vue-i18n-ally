import axios from 'axios'
import qs from 'qs'
import TranslateEngine, { TranslateOptions, TranslateResult } from './base'
import { Log } from '~/utils'
import { Config } from '~/core'

interface DeepLUsage {
  character_count: number
  character_limit: number
}

interface DeepLTranslate {
  detected_source_language: string
  text: string
}

interface DeepLTranslateRes {
  translations: DeepLTranslate[]
}

type GlossaryIdentifyingPartial = {
  glossary_id: string
}

type DeeplGlossaryInfo = {
  glossary_id: string,
  name: string
  ready: boolean,
  source_lang: string,
  target_lang: string,
  creation_time: string, // iso string
  entry_count: number
}

type GlossaryInfoCache = {
  lastUpdate?: number,
  glossaries?: Array<DeeplGlossaryInfo>
}

const deepl = axios.create({})

deepl.interceptors.request.use((req) => {
  req.baseURL = Config.deeplUseFreeApiEntry
    ? 'https://api-free.deepl.com/v2'
    : 'https://api.deepl.com/v2'

  req.headers['Authorization'] = `DeepL-Auth-Key ${Config.deeplApiKey}`

  if (!req.headers['Content-Type'] && (req.method === 'POST' || req.method === 'post')) {
    req.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    req.data = qs.stringify(req.data)
  }

  log(true, req)

  return req
})

deepl.interceptors.response.use((res) => {
  log(true, res)

  return res
})

function log(inspector: boolean, ...args: any[]): void {
  if (Config.deeplLog) {
    // eslint-disable-next-line no-console
    if (inspector) console.log('[DeepL]\n', ...args)
    else Log.raw(...args)
  }
}

async function usage(): Promise<DeepLUsage> {
  try {
    return await deepl.get('/usage').then(({ data }) => data)
  }
  catch (err) {
    log(false, err)

    throw err
  }
}

function stripeLocaleCode(locale?: string): string | undefined {
  if (!locale)
    return locale
  const index = locale.indexOf('-')
  if (index === -1)
    return locale
  return locale.slice(0, index)
}

class DeepL extends TranslateEngine {
  async translate(options: TranslateOptions) {

    try {
      const res: DeepLTranslateRes = await deepl({
        method: 'POST',
        url: '/translate',
        data: {
          text: options.text,
          source_lang: stripeLocaleCode(options.from || undefined),
          target_lang: stripeLocaleCode(options.to),
          ...await DeeplGlossaries.getTranslationRequestGlossaryIdentifier(options)
        },
      }).then(({ data }) => data)

      return this.transform(res.translations, options)
    }
    catch (err) {
      log(false, err)

      throw err
    }
  }

  transform(res: DeepLTranslate[], options: TranslateOptions): TranslateResult {
    const r: TranslateResult = {
      text: options.text,
      to: options.to || 'auto',
      from: options.from || 'auto',
      response: res,
      linkToResult: '',
    }

    try {
      const result: string[] = []

      res.forEach((tran: DeepLTranslate) => result.push(tran.text))

      r.result = result
    }
    catch (err) {}

    if (!r.detailed && !r.result) r.error = new Error('No result')

    log(false, `DEEPL TRANSLATE!! ${JSON.stringify(r.result)}, from ${options.from} to ${options.to}`)

    return r
  }
}

const GLOSSARY_CACHE_TTL = 60 * 1000 // 1 minute

/**
 * Encapsulate glossary handling.
 *
 * Glossaries are enabled when the `Config.deeplGlossariesDir` setting is set.
 * Files in that directory (only direct children) that follow the naming scheme "{sourceLanguage}-{targetLanguage}.csv"
 *  are considered sources for the glossaries that are kept on the DeepL-servers.
 *
 * To transmit (create/update is the same here) these files, the user must execute one of
 *  - `Commands.deepl_update_glossaries`
 *  - `Commands.deepl_update_glossary`.
 *
 * After the glossaries have been created, they are automatically applied when translating a matching language-pair with deepl.
 */
class DeeplGlossaries {

  /**
   * Keeps available glossaries as a list of source-/target language pairs.
   * Saves on a lot of requests, especially when performing bulk translation.
   */
  static readonly cache: GlossaryInfoCache = {}

  public isEnabled(): boolean {
    const dir = Config.deeplGlossariesDir

    return !! dir
  }

  /**
   * Update a single glossary.
   *
   * 1. Deletes all existing glossaries for the given source-/target language pair
   * 2. Creates a new glossary
   *
   * @param targetLanguage
   * @param sourceLanguage
   * @param content CSV-formatted glossary
   */
  public async updateGlossary(targetLanguage: string, sourceLanguage: string, content: string) {
    try {
      const glossaries = await this.getGlossaryIds(targetLanguage, sourceLanguage)

      glossaries.forEach(async id => {
        await this.deleteGlossary(id)
      })

      await this.createGlossary(targetLanguage, sourceLanguage, content)
    } finally {
      this.invalidateCache()
    }
  }

  /**
   * Retrieves an id of one glossary on DeepL-servers for the source-/target language pair.
   * If there are muliple glossaries, any is picked.
   *
   * @param targetLanguage
   * @param sourceLanguage
   * @returns
   */
  public async getGlossaryId(targetLanguage: string, sourceLanguage: string): Promise<string|undefined> {
    const glossaries = await this.getGlossaryIds(targetLanguage, sourceLanguage)

    if (glossaries.length >= 1) {
      return glossaries[0]
    }
  }

  /**
   * Retrieves meta-information about all glossaries on DeepL-servers.
   * This is the point that implements the caching of glossary information.
   *
   * @returns
   */
  public async readGlossaryList(forceUpdate: boolean = false): Promise<Array<DeeplGlossaryInfo>> {
    if (this.isCached() && ! forceUpdate) {
      return DeeplGlossaries.cache.glossaries!
    }

    try {
      const { glossaries } = await deepl({
        url: '/glossaries',
      }).then(({ data }) => data)

      if (glossaries) {
        DeeplGlossaries.cache.lastUpdate = Date.now()
        DeeplGlossaries.cache.glossaries = glossaries as Array<DeeplGlossaryInfo>

        return glossaries
      } else {
        throw new Error('Can not read glossaries')
      }
    } catch (err) {
      log(false, err)

      throw err
    }
  }

  /**
   * Retrieves a list of ids of all glossaries on DeepL-servers for the source-/target language pair.
   *
   * @param targetLanguage
   * @param sourceLanguage
   * @returns
   */
  private async getGlossaryIds(targetLanguage: string, sourceLanguage: string): Promise<Array<string>> {
    const glossaries = await this.readGlossaryList()

    return glossaries.filter(({ source_lang, target_lang }) => {
          return source_lang === sourceLanguage && target_lang === targetLanguage
        })
        .map(glossary => glossary.glossary_id)
  }

  /**
   * Deletes a glossary.
   * @param id
   */
  private async deleteGlossary(id: string) {
    try {
      const { status, data } = await deepl({
        url: `/glossaries/${id}`,
        method: 'DELETE'
      })

      if (status === 204) {
        log(false, `Successfully deleted glossary ${id}`)
      } else {
        const { message, detail } = await data

        throw new Error(`Couldn't delete glossary ${id}: ${status}\n${message}\n${detail}`)
      }
    } catch (e) {
      log(false, `Couldn't delete glossary ${id}`, e)
      throw e
    }
  }

  /**
   * Creates a glossary on DeepL-servers.
   *
   * @param targetLanguage
   * @param sourceLanguage
   * @param content csv-formatted glossary
   */
  private async createGlossary(targetLanguage: string, sourceLanguage: string, content: string) {
    if (! content || content.length === 0) {
      throw new Error(`Didn't create glossary ${sourceLanguage} => ${targetLanguage}: with empty content.`)
    }

    try {
      const { status, data } = await deepl({
        url: `/glossaries`,
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        data : JSON.stringify({
          name : `${sourceLanguage}-${targetLanguage}`,
          source_lang : sourceLanguage,
          target_lang : targetLanguage,
          entries_format : 'csv',
          entries : content
        })
      })

      if (status !== 201) {
        // we have some kind of error
        const { message, detail } = data

        throw new Error(`Couldn't create glossary ${sourceLanguage} => ${targetLanguage}: ${status}\n${message}\n${detail}`)
      }
    } catch (e) {
      log(false, `Couldn't create glossary ${sourceLanguage} => ${targetLanguage}`, e)
      throw e
    }
  }

  private isCached(): boolean {
    return !! (DeeplGlossaries.cache.lastUpdate && Date.now() - DeeplGlossaries.cache.lastUpdate < GLOSSARY_CACHE_TTL)
  }

  private invalidateCache() {
    DeeplGlossaries.cache.lastUpdate = 0
    DeeplGlossaries.cache.glossaries = []
  }

  //
  // static
  //

  /**
   * Creates an object that - when spread into the translation request parameters - identifies a glossary.
   *
   * This can always safely be spreaded into the request params. An empty object is returned when
   *  - glossaries are disabled
   *  - no glossary is available for the language pair from the request
   *
   * @param options defines source-/target language pair
   * @returns glossary identification parameters
   */
  public static async getTranslationRequestGlossaryIdentifier(options: TranslateOptions): Promise<GlossaryIdentifyingPartial|{}> {
    try {
      const glossaries = new DeeplGlossaries()

      if (glossaries.isEnabled() && options.from && options.to) {
        const glossaryId = await glossaries.getGlossaryId(options.to, options.from)

        if (glossaryId) {
          return {
            glossary_id: glossaryId
          };
        }
      }
    } catch (error) {
      log(false, `Error reading glossary id for translation from ${options.from} => ${options.to}`, error)
    }

    return {};
  }
}

export default DeepL

export {
  usage,
  DeeplGlossaries
}
