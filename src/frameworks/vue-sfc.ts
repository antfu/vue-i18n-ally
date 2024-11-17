import { TextDocument } from 'vscode'
import { Framework, ScopeRange } from './base'
import { LanguageId } from '~/utils'
import { DefaultDynamicExtractionsRules, DefaultExtractionRules, extractionsParsers } from '~/extraction'
import { Config, RewriteKeySource, RewriteKeyContext } from '~/core'

class VueSFCFramework extends Framework {
  id = 'vue-sfc'
  display = 'Vue SFC'

  detection = {
    packageJSON: [
      '@kazupon/vue-i18n-loader',
      '@intlify/vue-i18n-loader',
      '@intlify/vite-plugin-vue-i18n',
      '@intlify/unplugin-vue-i18n',
    ],
  }

  languageIds: LanguageId[] = [
    'vue',
    'vue-html',
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
    'ejs',
  ]

  // 增加翻譯函數匹配模式
  usageMatchRegex = [
    '\\Wt\\(\\s*[\'"`]({key})[\'"`]',
  ]

  // 支援自動提取
  supportAutoExtraction = ['vue']

  detectHardStrings(doc: TextDocument) {
    const text = doc.getText()

    return extractionsParsers.html.detect(
      text,
      DefaultExtractionRules,
      DefaultDynamicExtractionsRules,
      Config.extractParserHTMLOptions,
      script => extractionsParsers.babel.detect(
        script,
        DefaultExtractionRules,
        DefaultDynamicExtractionsRules,
        Config.extractParserBabelOptions,
      ),
    )
  }

  refactorTemplates(keypath: string, args: string[] = []) {
    let params = `'${keypath}'`
    if (args.length)
      params += `, [${args.join(', ')}]`

    return [
      `{{ $tr(${params}) }}`,
      `tr(${params})`,
      keypath,
    ]
  }

  rewriteKeys(key: string, source: RewriteKeySource, context: RewriteKeyContext = {}) {
    if (!Config.enableKeyPrefix)
      return key

    // 如果已經是完整的 key，直接返回
    if (key.includes('.'))
      return key

    // 直接使用 context.namespace，因為在 getScopeRange 已經決定好要使用哪個 namespace
    // getScopeRange 會處理 useTranslation(['ns1', 'common']) 的情況，並選擇第一個非 common 的 namespace
    const namespace = context?.namespace || Config.defaultNamespace

    return `${namespace}.${key}`
  }

  getScopeRange(document: TextDocument): ScopeRange[] | undefined {
    if (!this.languageIds.includes(document.languageId as any) || !Config.enableKeyPrefix)
      return

    const ranges: ScopeRange[] = []
    const text = document.getText()
    // const regUse = /useTranslation\(\s*(?:\[\s*['"`](?<translationKeys>.*?)['"`](?:,\s*['"`][^"'`]*['"`])*\s*\]|\(\))?\s*\)/g
    const regUse = /useTranslation\(\s*\[\s*(['"`](?:\w+(?:\.\w+)*)['"`](?:\s*,\s*['"`](?:\w+(?:\.\w+)*)['"`])*)\s*\]/g

    for (const match of text.matchAll(regUse)) {
      if (typeof match.index !== 'number')
        continue

      // 解析所有 namespaces
      const namespaces = match[1]
        .split(',')
        .map(ns => ns.trim().replace(/['"`,\s]/g, ''))
        .filter((ns) => {
          // 保留所有非 common 的命名空間，包括帶點號的
          return ns && ns !== 'common'
        })

      // 如果沒有非 common 的 namespace，使用預設值
      if (namespaces.length === 0)
        namespaces.push(Config.defaultNamespace as string)

      // 如果沒有指定 namespace 或是空括號，使用默認值
      const namespace = namespaces[0] || Config.defaultNamespace
      // const namespace = match.groups?.translationKeys
      //   ? match.groups.translationKeys.split(',')
      //     .map(ns => ns.trim().replace(/['"`,\s]/g, ''))
      //     .find(ns => ns !== 'common') || Config.defaultNamespace
      //   : Config.defaultNamespace

      ranges.push({
        start: match.index,
        end: text.length,
        namespace, // 第一個非 common namespace
        namespaces, // 儲存所有非 common namespaces
      })
    }

    return ranges
  }

  enableFeatures = {
    VueSfc: true,
  }
}

export default VueSFCFramework
