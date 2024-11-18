import { TextDocument } from 'vscode'
import { Parser } from 'htmlparser2'
import { Framework, ScopeRange } from './base'
import { LanguageId } from '~/utils'

export default class TranslocoFramework extends Framework {
  id = 'transloco'
  display = 'Angular Transloco'

  detection = {
    packageJSON: [
      '@ngneat/transloco',
    ],
  }

  languageIds: LanguageId[] = [
    'javascript',
    'typescript',
    'html',
  ]

  usageMatchRegex = [
    // https://ngneat.github.io/transloco/docs/translation-in-the-template#pipe
    '[`\'"]({key})[`\'"][\\s\\n]*\\|[\\s\\n]*transloco',
    // https://ngneat.github.io/transloco/docs/translation-in-the-template#structural-directive
    '[^\\w\\d](?:t)\\([\\s\\n]*[\'"`]({key})[\'"`]',
    // https://ngneat.github.io/transloco/docs/translation-api
    '[^\\w\\d](?:translate|selectTranslate|getTranslateObject|selectTranslateObject|getTranslation|setTranslationKey)\\([\\s\\n]*["\'`](.*?)["\'`][\\s\\n]*\\)',
    // https://ngneat.github.io/transloco/docs/translation-in-the-template#attribute-directive
    '[^*\\w\\d]transloco=[\'"`]({key})[\'"`]',
  ]

  refactorTemplates(keypath: string) {
    return [
      `{{ '${keypath}' | transloco }}`,
      `t('${keypath}')`,
      keypath,
    ]
  }

  rewriteKeys(key: string) {
    // find extra scope
    const regex = /[\'"`]([\w.]+)[\'"`]/gm
    let index = 0
    let match, actualKey, scope

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(key)) !== null) {
      // this is necessary to avoid infinite loops with zero-width matches
      if (match.index === regex.lastIndex)
        regex.lastIndex++

      if (index === 0)
        actualKey = match[1]

      if (index === 1)
        scope = match[1]

      index++
    }

    // return new key if the extra scope regex matched
    return actualKey && scope ? `${scope}.${actualKey}` : key
  }

  // support for `read` (old, deprecated) AND `prefix` (new) syntax
  // `read` is deprecated in favor of `prefix` and will be removed in the next major version.
  // https://jsverse.github.io/transloco/docs/translation-in-the-template#utilizing-the-prefix-input
  getScopeRange(document: TextDocument): ScopeRange[] | undefined {
    if (document.languageId !== 'html')
      return

    const ranges: ScopeRange[] = []

    const regex = /^.*(?:read|prefix):\s*['"](.+?)['"].*$/
    const tagStack: string[] = []
    let stackDepth = -1
    let namespace = ''
    let start = 0

    const parser = new Parser(
      {
        onopentag(name, attribs) {
          tagStack.push(name)
          const attr = attribs['*transloco']
          if (attr && parser.endIndex != null) {
            if (!regex.test(attr))
              return
            namespace = attr.replace(regex, '$1')
            start = parser.startIndex
            stackDepth = tagStack.length
          }
        },
        onclosetag() {
          if (tagStack.length === stackDepth) {
            if (namespace) {
              ranges.push({
                namespace,
                start,
                end: parser.endIndex ?? parser.startIndex,
              })
            }
            stackDepth = -1
            namespace = ''
            start = 0
          }
          tagStack.pop()
        },
      },
      { decodeEntities: true },
    )
    parser.write(document.getText())
    parser.end()

    return ranges
  }
}
