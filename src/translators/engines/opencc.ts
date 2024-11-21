import TranslateEngine, { TranslateOptions, TranslateResult } from './base';
/* eslint @typescript-eslint/no-var-requires: 0 */
const OpenCC = require('opencc-js')

const langs: Record<string, string> = {
  'zh-cn': 'cn',
  'zh-tw': 'tw',
  'zh-hk': 'hk',
}

const getLang = (locale?: string) => {
  locale ||= 'cn'
  return langs[locale.toLowerCase()] || ''
}

const supportLangs = ['cn', 'tw', 'hk']

export default class OpenCCTranslateEngine extends TranslateEngine {
  async translate(options: TranslateOptions): Promise<TranslateResult> {
    const to = getLang(options.to)
    const from = getLang(options.from)

    const r: TranslateResult = {
      text: options.text,
      from: options.from || 'auto',
      to: options.to || 'auto',
      response: null,
      linkToResult: '',
    }

    // Return error, when from or to not supports, so translate will fallback to next engine.
    if (!supportLangs.includes(to) || !supportLangs.includes(from)) {
      r.error = new Error(`Can not use OpenCC convert to: ${to}`)
      return r
    }

    const converter = OpenCC.Converter({ from, to })

    const out: string = converter(options.text)

    return {
      text: options.text,
      from: options.from || '',
      to: options.to || '',
      response: null,
      linkToResult: '',
      result: [out],
    }
  }
}
