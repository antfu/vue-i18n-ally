import { CompletionItemProvider, TextDocument, Position, CompletionItem, CompletionItemKind, languages } from 'vscode'
import { ExtensionModule } from '~/modules'
import { Global, KeyDetector, Loader, CurrentFile, LocaleTree, LocaleNode, Config } from '~/core'

class CompletionProvider implements CompletionItemProvider {
  public provideCompletionItems(
    document: TextDocument,
    position: Position,
  ) {
    if (!Global.enabled)
      return

    const loader: Loader = CurrentFile.loader
    const key = KeyDetector.getKey(document, position, true)

    if (key === undefined)
      return

    let scopedKey = KeyDetector.getScopedKey(document, position)

    if (!key) {
      scopedKey = scopedKey || Config.defaultNamespace

      return Object
        .values(CurrentFile.loader.keys)
        .filter(key => key.startsWith(scopedKey || ''))
        .map((key) => {
          let resolvedKey = key
          if (scopedKey)
            resolvedKey = key.replace(`${scopedKey}.`, '')

          const item = new CompletionItem(resolvedKey, CompletionItemKind.Text)
          item.detail = loader.getValueByKey(key)
          return item
        })
    }

    let parent = ''

    const parts = key.split(/[.:]/g)

    if (parts.length > 1)
      parent = parts.slice(0, -1).join('.')

    let node: LocaleTree | LocaleNode | undefined

    if (scopedKey && key)
      node = loader.getTreeNodeByKey([scopedKey, key].join('.'))

    if (!key)
      node = loader.root

    if (!node)
      node = loader.getTreeNodeByKey(key)

    if (!node && parent)
      node = loader.getTreeNodeByKey(parent)

    if (!node || node.type !== 'tree')
      return

    return Object
      .values(node.children)
      .map((child) => {
        const item = new CompletionItem(
          child.keyname,
          child.type === 'tree'
            ? CompletionItemKind.Field
            : CompletionItemKind.Text,
        )
        item.commitCharacters = ['.', ':']
        item.detail = child.type === 'node' ? child.getValue() : undefined
        return item
      })
  }
}

const m: ExtensionModule = () => {
  return languages.registerCompletionItemProvider(
    Global.getDocumentSelectors(),
    new CompletionProvider(),
    '.', '\'', '"', '`', ':',
  )
}

export default m
