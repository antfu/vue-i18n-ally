import { ExtensionContext, TreeItemCollapsibleState } from 'vscode'
import { LocaleTreeItem } from '.'
import { NodeHelper } from '~/utils'
import { KeyUsage, LocaleNode, CurrentFile } from '~/core'

export class UsageReportTreeItem extends LocaleTreeItem {
  constructor(ctx: ExtensionContext, public readonly usage: KeyUsage, public readonly type: string) {
    super(ctx, CurrentFile.loader.getTreeNodeByKey(usage.keypath) || new LocaleNode({ shadow: true, keypath: usage.keypath }), true)
  }

  get length() {
    return this.usage.occurrences.length
  }

  get label() {
    if (this.length)
      return `${super.label} (${this.length})`
    return super.label
  }

  set label(_) { }
  get contextValue() {
    if (!this.length) {
      const values: string[] = [this.node.type]

      if (!this.node.readonly) {
        values.push('writable')
        if (NodeHelper.isEditable(this.node))
          values.push('editable')
      }

      if (NodeHelper.isOpenable(this.node))
        values.push('openable')

      values.push(`key_${this.type}`)

      return values.join('-')
    }
    return ''
  }

  get collapsibleState() {
    return this.length
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None
  }

  set collapsibleState(_) { }
}
