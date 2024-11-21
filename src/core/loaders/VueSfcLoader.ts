import { workspace, Uri, TextDocument, WorkspaceEdit, Range } from 'vscode'
import { squeeze, SFCI18nBlock, MetaLocaleMessage, infuse } from 'vue-i18n-locale-message'
import { PendingWrite, NodeOptions } from '../types'
import { LocaleTree } from '../Nodes'
import { Global } from '../Global'
import { Config } from '../Config'
import { Loader } from './Loader'
import { Log, applyPendingToObject, File, unflatten } from '~/utils'

export class VueSfcLoader extends Loader {
  constructor(
    public readonly uri: Uri,
  ) {
    super(`[SFC]${uri.fsPath}`)

    this.load()
  }

  _parsedSections: SFCI18nBlock[] = []
  _meta: MetaLocaleMessage | undefined

  get filepath() {
    return this.uri.fsPath
  }

  get files() {
    return []
  }

  async load() {
    const filepath = this.filepath
    Log.info(`📑 Loading sfc ${filepath}`)
    const doc = await workspace.openTextDocument(this.uri)
    const meta = this._meta = squeeze(Global.rootpath, this.getSFCFileInfo(doc))
    this._parsedSections = meta.components[filepath]

    this.updateLocalesTree()
    this._onDidChange.fire(this.name)
  }

  private getOptions(section: SFCI18nBlock, locale: string, index: number): NodeOptions {
    return {
      filepath: section.src || this.uri.fsPath,
      locale: Config.normalizeLocale(locale),
      features: {
        VueSfc: true,
      },
      meta: {
        VueSfcSectionIndex: index,
        VueSfcLocale: locale,
      },
    }
  }

  private getSFCFileInfo(doc: TextDocument) {
    return [{
      path: this.filepath,
      content: doc.getText(),
    }]
  }

  _locales = new Set<string>()

  private updateLocalesTree() {
    this._flattenLocaleTree = {}
    this._locales = new Set()

    const tree = new LocaleTree({ keypath: '', features: { VueSfc: true } })
    for (const [index, section] of this._parsedSections.entries()) {
      if (!section.messages)
        continue
      const messages = unflatten(section.messages)
      for (const [locale, value] of Object.entries(messages)) {
        this._locales.add(Config.normalizeLocale(locale))
        this.updateTree(tree, value, '', '', this.getOptions(section, locale, index))
      }
    }
    this._localeTree = tree
  }

  get locales() {
    return Array.from(this._locales)
  }

  async write(pendings: PendingWrite | PendingWrite[]) {
    if (!Array.isArray(pendings))
      pendings = [pendings]
    pendings = pendings.filter(i => i)

    if (!this._meta)
      return

    for (const pending of pendings) {
      const record = this.getRecordByKey(pending.keypath, pending.locale, true)
      if (!record)
        continue

      const sectionIndex = record.meta ? (record.meta.VueSfcSectionIndex || 0) : 0

      const section = this._meta.components[this.filepath][sectionIndex]

      const locale = record?.meta?.VueSfcLocale || pending.locale

      section.messages[locale] = applyPendingToObject(
        section.messages[locale] || {},
        pending.keypath,
        pending.value,
        await Global.requestKeyStyle(),
      )
    }

    const doc = await workspace.openTextDocument(this.uri)
    const [file] = infuse(Global.rootpath, this.getSFCFileInfo(doc), this._meta)

    if (doc.isDirty) {
      const edit = new WorkspaceEdit()
      edit.replace(this.uri, new Range(doc.positionAt(0), doc.positionAt(Infinity)), file.content)

      await workspace.applyEdit(edit)
    }
    else {
      await File.write(this.filepath, file.content)
    }

    await this.load()
  }

  canHandleWrites(pending: PendingWrite) {
    return !!this._meta && pending.filepath === this.filepath
  }
}
