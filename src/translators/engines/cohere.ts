import axios from 'axios'
import TranslateEngine, { TranslateOptions, TranslateResult } from './base'
import { Config } from '~/core'

export default class CohereTranslate extends TranslateEngine {
  apiRoot = 'https://api.cohere.com'

  async translate(options: TranslateOptions) {
    const systemPrompt = Config.cohereTranslateInstructions
    const apiKey = Config.cohereApiKey
    let apiRoot = this.apiRoot
    if (Config.cohereApiRoot) apiRoot = Config.cohereApiRoot.replace(/\/$/, '')
    const model = Config.cohereApiModel

    const response = await axios.post(
      `${apiRoot}/v2/chat`,
      {
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: this.generateUserPrompts(options),
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Client-Name': 'i18n-ally',
        },
      },
    )

    return this.transform(response, options)
  }

  transform(response: any, options: TranslateOptions): TranslateResult {
    const { text, from = 'auto', to = 'auto' } = options

    const translatedText = response.data.message.content[0].text.trim()

    const r: TranslateResult = {
      text,
      to,
      from,
      response,
      result: translatedText ? [translatedText] : undefined,
      linkToResult: '',
    }

    return r
  }

  generateUserPrompts(options: TranslateOptions): string {
    const sourceLang = options.from
    const targetLang = options.to

    const generatedUserPrompt = `translate from ${sourceLang} to ${targetLang}:\n\n${options.text}`

    return generatedUserPrompt
  }
}
