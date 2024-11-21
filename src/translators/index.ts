import TranslateEngine, { TranslateOptions } from './engines/base'
import GoogleTranslateEngine from './engines/google'
import GoogleTranslateCnEngine from './engines/google-cn'
import DeepLTranslateEngine from './engines/deepl'
import LibreTranslateEngine from './engines/libretranslate'
import BaiduTranslate from './engines/baidu'
import OpenAITranslateEngine from './engines/openai'
import OpenCCTranslateEngine from './engines/opencc'

export class Translator {
  engines: Record<string, TranslateEngine> ={
    'google': new GoogleTranslateEngine(),
    'google-cn': new GoogleTranslateCnEngine(),
    'deepl': new DeepLTranslateEngine(),
    'libretranslate': new LibreTranslateEngine(),
    'baidu': new BaiduTranslate(),
    'openai': new OpenAITranslateEngine(),
    'opencc': new OpenCCTranslateEngine(),
  }

  async translate(options: TranslateOptions & { engine: string }) {
    const engine = this.engines[options.engine]
    return await engine.translate(options)
  }
}

export {
  TranslateEngine,
  GoogleTranslateEngine,
  GoogleTranslateCnEngine,
  DeepLTranslateEngine,
  LibreTranslateEngine,
  BaiduTranslate,
  OpenAITranslateEngine,
  OpenCCTranslateEngine,
}

export * from './engines/base'
