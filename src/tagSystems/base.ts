import { FLAGS } from '~/utils'

export abstract class BaseTagSystem {
  normalize(locale?: string, fallback = 'en', strict = false): string {
    return locale || fallback
  }

  toBCP47(str: string): string | undefined {
    return str
  }

  fromBCP47(bcp47: string): string {
    return bcp47
  }

  toFlagname(locale: string): string | undefined {
    return undefined
  }

  getFlagName(locale: string): string {
    const flag = this.toFlagname(locale)
    if (!flag || !FLAGS.includes(flag))
      return 'unknown'
    return flag
  }

  lookup(locale: string): string|undefined {
    return locale
  }
}
