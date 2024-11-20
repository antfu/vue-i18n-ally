export interface TranslateEngineConfig {
  timeout?: number
  apiKey?: string
}

export interface TranslateOptions {
  text: string
  key: string
  from?: string
  to?: string
  description?: string
}

export interface TranslateResult {
  text: string
  from: string
  to: string
  response: any
  linkToResult: string
  error?: Error
  result?: string[]
  detailed?: string[]
}

export default abstract class TranslateEngine {
  constructor(public config: TranslateEngineConfig = {}) {}

  resolve(lang: string) {
    return lang
  }

  abstract translate(options: TranslateOptions): Promise<TranslateResult>
}
