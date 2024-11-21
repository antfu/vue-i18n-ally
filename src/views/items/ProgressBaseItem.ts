import { ExtensionContext, TreeItemCollapsibleState } from 'vscode'
import { BaseTreeItem } from './Base'
import { decorateLocale } from '~/utils'
import { Coverage } from '~/core'

export abstract class ProgressBaseItem extends BaseTreeItem {
  constructor(public readonly ctx: ExtensionContext, public readonly node: Coverage) {
    super(ctx)
  }

  getLabel() {
    return decorateLocale(this.node.locale)
  }

  collapsibleState = TreeItemCollapsibleState.Collapsed
}
