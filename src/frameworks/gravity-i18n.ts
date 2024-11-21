import { TextDocument } from 'vscode'
import { Framework, ScopeRange } from './base'
import { LanguageId } from '~/utils'
import { RewriteKeySource, RewriteKeyContext, DirStructure } from '~/core'

const SCOPED_HELPERS_REGEX = /const (.*) = i18n\.(bind|keyset)\((null,)?\s*(['"`](.*)['"`])/g
const DEFAULT_USAGES_REGEX = /i18n\(\s*["\'`](.*?)["\'`],\s*["\'`](.*?)["\'`]/g

class GravityI18nFramework extends Framework {
  id = 'gravity-i18n'
  display = 'gravity-i18n'
  namespaceDelimiter = ':'
  perferredKeystyle = 'nested'
  preferredDirStructure?: DirStructure = 'file'

  namespaceDelimiters = [':']
  namespaceDelimitersRegex = /[\:]/g
  monopoly = true

  enableFeatures = {
    namespace: true,
  }

  detection = {
    packageJSON: [
      '@gravity-ui/i18n',
    ],
  }

  languageIds: LanguageId[] = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
  ]

  supportAutoExtraction = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
  ]

  usageMatchRegex = [
    // Basic usage
    'i18n\\(\\s*["\'`].*["\'`],\\s*["\'`]({key})["\'`]',
    // Scoped usage
    'i18n\\w+\\s*\\(\\s*[\'"`]({key})[\'"`]',
  ]

  derivedKeyRules = [
    '{key}\\[0\\]',
    '{key}\\[1\\]',
    '{key}\\[2\\]',
    '{key}\\[3\\]',
    '{key}\\[4\\]',
    '{key}\\[5\\]',
    '{key}.zero',
    '{key}.one',
    '{key}.two',
    '{key}.few',
    '{key}.many',
    '{key}.other',
  ]

  refactorTemplates(keypath: string, _args: string[], doc?: TextDocument) {
    const keyparts = keypath.split('.')
    let namespace = ''
    let key = ''

    if (keyparts.length > 1) {
      namespace = keyparts.slice(0, keyparts.length - 1).join('.')
      key = keyparts[keyparts.length - 1]
    }
    else {
      key = keyparts[0]
    }

    const namespaces = new Set<string>([])
    const namespaceHelpersMap = new Map<string, string>()

    const isJsx = Boolean(doc?.fileName.match(/\.(tsx|jsx)$/))

    if (doc) {
      const scopedFunctionsMatchArray = [...doc.getText().matchAll(SCOPED_HELPERS_REGEX)]

      scopedFunctionsMatchArray.forEach((match) => {
        if (typeof match.index !== 'number')
          return

        namespaces.add(match[5])
        namespaceHelpersMap.set(match[5], match[1])
      })

      const defaultUsagesMatchArray = [...doc.getText().matchAll(DEFAULT_USAGES_REGEX)]

      defaultUsagesMatchArray.forEach((match) => {
        if (typeof match.index !== 'number')
          return

        namespaces.add(match[1])
      })
    }

    if (namespace) {
      const namespaceHelper = namespaceHelpersMap.get(namespace)
      return [
        ...(namespaceHelper ? [`${namespaceHelper}('${key}')`] : []),
        ...(namespaceHelper && isJsx ? [`{${namespaceHelper}('${key}')}`] : []),
        `i18n('${namespace}', '${key}')`,
        ...(isJsx ? [`{i18n('${namespace}', '${key}')}`] : []),
      ]
    }

    const namespacesArr = [...namespaces]

    return [
      ...namespacesArr.map(namespace => `i18n('${namespace}', '${key}')`),
      ...(isJsx ? namespacesArr.map(namespace => `{i18n('${namespace}', '${key}')}`) : []),
      `i18n('', '${keypath}')`,
      ...(isJsx ? [`{i18n('', '${key}')}`] : []),
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

    // const i18nK = i18n.bind(null, 'namespace');
    // const i18nK = i18n.keyset(null, 'namespace');
    const namespaceMatchArray = [...text.matchAll(SCOPED_HELPERS_REGEX)]
    for (let i = 0; i < namespaceMatchArray.length; i++) {
      const currentNamespaceMatch = namespaceMatchArray[i]
      if (typeof currentNamespaceMatch.index !== 'number')
        continue

      const scopedFunctionName = currentNamespaceMatch[1]
      const namespace = currentNamespaceMatch[5]
      const scopedTRegex = new RegExp(`${scopedFunctionName}\\(\s*['"\`](.*?)['"\`]`, 'g')
      for (const match of text.matchAll(scopedTRegex)) {
        if (typeof match.index !== 'number')
          continue
        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
          namespace,
        })
      }
    }

    // i18n('namespace', 'key')
    const defaultUsages = [...text.matchAll(DEFAULT_USAGES_REGEX)]
    for (const match of defaultUsages) {
      if (typeof match.index !== 'number')
        continue

      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
        namespace: match[1],
      })
    }

    return ranges
  }
}

export default GravityI18nFramework
