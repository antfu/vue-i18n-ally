import { TextDocument } from 'vscode'
import { Framework, ScopeRange } from './base'
import { LanguageId } from '~/utils'
import { RewriteKeySource, RewriteKeyContext, KeyStyle } from '~/core'

class NextIntlFramework extends Framework {
  id = 'next-intl'
  display = 'next-intl'
  namespaceDelimiter = '.'
  preferredKeystyle?: KeyStyle = 'nested'

  namespaceDelimiters = ['.']
  namespaceDelimitersRegex = /[\.]/g

  detection = {
    packageJSON: [
      'next-intl',
    ],
  }

  languageIds: LanguageId[] = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
    'ejs',
  ]

  usageMatchRegex = [
    // Basic usage
    '[^\\w\\d]t\\s*\\(\\s*[\'"`]({key})[\'"`]',

    // Rich text
    '[^\\w\\d]t\\s*\.rich\\s*\\(\\s*[\'"`]({key})[\'"`]',

    // Markup text
    '[^\\w\\d]t\\s*\.markup\\s*\\(\\s*[\'"`]({key})[\'"`]',

    // Raw text
    '[^\\w\\d]t\\s*\.raw\\s*\\(\\s*[\'"`]({key})[\'"`]',
  ]

  refactorTemplates(keypath: string) {
    // Ideally we'd automatically consider the namespace here. Since this
    // doesn't seem to be possible though, we'll generate all permutations for
    // the `keypath`. E.g. `one.two.three` will generate `three`, `two.three`,
    // `one.two.three`.

    const keypaths = keypath.split('.').map((cur, index, parts) => {
      return parts.slice(parts.length - index - 1).join('.')
    })
    return [
      ...keypaths.map(cur =>
        `{t('${cur}')}`,
      ),
      ...keypaths.map(cur =>
        `t('${cur}')`,
      ),
    ]
  }

  rewriteKeys(key: string, source: RewriteKeySource, context: RewriteKeyContext = {}) {
    const dottedKey = key.split(this.namespaceDelimitersRegex).join('.')

    // When the namespace is explicitly set, ignore the current namespace scope
    if (
      this.namespaceDelimiters.some(delimiter => key.includes(delimiter))
      && context.namespace
      && dottedKey.startsWith(context.namespace.split(this.namespaceDelimitersRegex).join('.'))
    ) {
      // +1 for the an extra `.`
      key = key.slice(context.namespace.length + 1)
    }

    return dottedKey
  }

  getScopeRange(document: TextDocument): ScopeRange[] | undefined {
    if (!this.languageIds.includes(document.languageId as any))
      return

    const ranges: ScopeRange[] = []
    const text = document.getText()

    // Find matches of `useTranslations` and `getTranslations`. Later occurences will
    // override previous ones (this allows for multiple components with different
    // namespaces in the same file). Note that `getTranslations` can either be called
    // with a single string argument or an object with a `namespace` key.
    const regex = /(useTranslations\(\s*|getTranslations\(\s*|namespace:\s+)(['"`](.*?)['"`])?/g
    let prevGlobalScope = false
    for (const match of text.matchAll(regex)) {
      if (typeof match.index !== 'number')
        continue

      const namespace = match[3]

      // End previous scope
      if (prevGlobalScope)
        ranges[ranges.length - 1].end = match.index

      // Start a new scope if a namespace is provided
      if (namespace) {
        prevGlobalScope = true
        ranges.push({
          start: match.index,
          end: text.length,
          namespace,
        })
      }
    }

    return ranges
  }
}

export default NextIntlFramework
