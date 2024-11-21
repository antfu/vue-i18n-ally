/* eslint-disable @typescript-eslint/no-unused-vars */
import { Disposable, EventEmitter } from 'vscode'
import { uniq, isObject } from 'lodash'
import { LocaleTree, LocaleNode, LocaleRecord, FlattenLocaleTree } from '../Nodes'
import { Coverage, FileInfo, PendingWrite, NodeOptions, RewriteKeySource, RewriteKeyContext, DataProcessContext } from '../types'
import { Config, Global } from '..'
import { resolveFlattenRootKeypath, resolveFlattenRoot, NodeHelper } from '~/utils'

const NESTED_PLURALIZATION_KEYS = ['one', 'other', 'zero', 'two', 'few', 'many', '0', '1', '2', '3', '4', '5']
export abstract class Loader extends Disposable {
  protected _disposables: Disposable[] = []
  protected _onDidChange = new EventEmitter<string>()
  readonly onDidChange = this._onDidChange.event

  protected _flattenLocaleTree: FlattenLocaleTree = {}
  protected _localeTree: LocaleTree = new LocaleTree({ keypath: '' })

  constructor(
    public readonly name: string,
  ) {
    super(() => this.onDispose())
  }

  abstract get locales(): string[]

  get root() {
    return this._localeTree
  }

  get flattenLocaleTree() {
    return this._flattenLocaleTree
  }

  get files(): FileInfo[] {
    return []
  }

  get keys(): string[] {
    return uniq(Object.keys(this.flattenLocaleTree))
  }

  getCoverage(locale: string, keys?: string[]): Coverage | undefined {
    const allKeys = keys || this.keys
    allKeys.sort()
    const translatedKeys = allKeys.filter(key => this.flattenLocaleTree[key] && this.flattenLocaleTree[key].getValue(locale))
    const missingKeys = allKeys.filter(key => (!this.flattenLocaleTree[key]) || this.flattenLocaleTree[key].getValue(locale) == null)
    const emptyKeys = allKeys.filter(key => !translatedKeys.includes(key) && !missingKeys.includes(key))
    const total = allKeys.length
    const translated = translatedKeys.length
    const missing = missingKeys.length
    return {
      locale,
      total,
      missing,
      translated,
      missingKeys,
      allKeys,
      translatedKeys,
      emptyKeys,
    }
  }

  protected updateTree(tree: LocaleTree | undefined, data: any, keypath: string, keyname: string, options: NodeOptions, isCollection = false) {
    tree = tree || new LocaleTree({
      keypath,
      keyname,
      isCollection,
      features: options.features,
      meta: options.meta,
    })
    tree.values[options.locale] = data

    for (const [key, value] of Object.entries(data)) {
      if (value == null)
        continue

      const newKeyPath = keypath
        ? (isCollection
          ? `${keypath}[${key}]`
          : `${keypath}.${key}`)
        : (isCollection
          ? `[${key}]`
          : key)

      let node = tree.getChild(key)

      // should go nested
      if (Array.isArray(value)) {
        let subtree: LocaleTree|undefined
        if (node && node.type === 'tree')
          subtree = node as LocaleTree

        tree.setChild(key, this.updateTree(subtree, value, newKeyPath, key, options, true))
        continue
      }

      if (isObject(value)) {
        let subtree: LocaleTree|undefined
        if (node && node.type === 'tree')
          subtree = node as LocaleTree

        tree.setChild(key, this.updateTree(subtree, value, newKeyPath, key, options))
        continue
      }

      // init node
      if (!node) {
        node = new LocaleNode({
          keypath: newKeyPath,
          keyname: key,
          readonly: options.readonly,
          features: options.features,
          meta: options.meta,
        })
        tree.setChild(key, node)
        this._flattenLocaleTree[resolveFlattenRootKeypath(node.keypath)] = node
      }

      // add locales to exitsing node
      if (node && node.type === 'node') {
        node.locales[options.locale] = new LocaleRecord({
          keypath: newKeyPath,
          keyname: key,
          value: `${value}`,
          locale: options.locale,
          filepath: options.filepath,
          features: options.features,
          meta: options.meta,
          readonly: options.readonly,
        })
      }
    }
    return tree
  }

  rewriteKeys(key: string, source: RewriteKeySource, context: RewriteKeyContext = {}) {
    if (Config.disablePathParsing)
      return key

    for (const framework of Global.enabledFrameworks)
      key = framework.rewriteKeys(key, source, context)
    return key
  }

  preprocessData(data: object, context: DataProcessContext = {}) {
    for (const framework of Global.enabledFrameworks)
      data = framework.preprocessData(data, context)
    return data
  }

  deprocessData(data: object, context: DataProcessContext = {}) {
    for (const framework of Global.enabledFrameworks)
      data = framework.deprocessData(data, context)
    return data
  }

  getTreeNodeByKey(key: string, tree?: LocaleTree): LocaleNode | LocaleTree | undefined {
    const root = !tree
    tree = tree || this.root

    // flatten style
    if (root || Config.disablePathParsing) {
      const node = tree.getChild(key)
      if (node)
        return node
    }

    if (Config.disablePathParsing)
      return

    // tree style
    const keys = NodeHelper.splitKeypath(key)
    const head = keys[0]
    const remaining = keys.slice(1).join('.')
    const node = tree.getChild(head)
    if (remaining === '')
      return node
    if (node && node.type === 'tree')
      return this.getTreeNodeByKey(remaining, node)

    return undefined
  }

  getFilepathByKey(key: string, locale?: string) {
    locale = locale || Config.displayLanguage
    const record = this.getRecordByKey(key, locale)
    if (record && record.filepath)
      return record.filepath
    return undefined
  }

  getNamespaceFromFilepath(filepath: string): string | undefined {
    return undefined
  }

  private stripAnnotationString(str: string, maxlength = 0) {
    if (!str)
      return
    if (maxlength && str.length > maxlength)
      str = `${str.substring(0, maxlength)}…`
    return str
  }

  private treeNodeValueHasPluralizationKeys(value: Record<string, any>) {
    return value && isObject(value) && Object.keys(value).some(key => NESTED_PLURALIZATION_KEYS.includes(key))
  }

  private firstPluralizationKey(value: Record<string, any>) {
    if (!value || !isObject(value))
      return undefined

    return Object.keys(value).find(key => NESTED_PLURALIZATION_KEYS.includes(key))
  }

  private firstPluralizationKeyValue(value: Record<string, any>) {
    if (!value || !isObject(value))
      return undefined

    const firstPluralizationKey = this.firstPluralizationKey(value)

    return firstPluralizationKey ? (value as Record<string, any>)[firstPluralizationKey] : undefined
  }

  getValueByKey(key: string, locale?: string, maxlength = 0, stringifySpace?: number, context: RewriteKeyContext = {}) {
    locale = locale || Config.displayLanguage

    const node = resolveFlattenRoot(this.getTreeNodeByKey(key))

    if (!node)
      return undefined

    if (node.type === 'tree') {
      const value = node.values[locale]
      if (!value)
        return undefined

      if (Config._keyStyle !== 'flat' && this.treeNodeValueHasPluralizationKeys(value))
        return this.stripAnnotationString(this.firstPluralizationKeyValue(value), maxlength)

      let text = JSON
        .stringify(value, null, stringifySpace)
        .replace(/"(\w+?)":/g, ' $1:')
        .replace(/}/, ' }')

      if (maxlength && text.length > maxlength) {
        if (node.isCollection)
          text = '[…]'
        else
          text = '{…}'
      }
      return text
    }
    else {
      return this.stripAnnotationString(node.getValue(locale, true), maxlength)
    }
  }

  getShadowNodeByKey(key: string) {
    return new LocaleNode({ keypath: key, shadow: true })
  }

  getNodeByKey(key: string, shadow = false, locale?: string): LocaleNode | undefined {
    const node = resolveFlattenRoot(this.getTreeNodeByKey(key))
    if (!node && shadow)
      return this.getShadowNodeByKey(key)
    if (node && node.type !== 'tree')
      return node

    const language = locale || Config.sourceLanguage
    if (
      node
      && node.type === 'tree'
      && Config._keyStyle !== 'flat'
      && this.treeNodeValueHasPluralizationKeys(node.values[language])
    ) {
      const subkey = this.firstPluralizationKey(node.values[language])
      if (subkey && node.children[subkey] && node.children[subkey].type === 'node')
        return node.children[subkey] as LocaleNode
    }
  }

  getTranslationsByKey(key: string, shadow = true, locale?: string) {
    const node = this.getNodeByKey(key, shadow, locale)
    if (!node)
      return {}
    if (shadow)
      return this.getShadowLocales(node)
    else
      return node.locales
  }

  getRecordByKey(key: string, locale: string, shadow = false): LocaleRecord | undefined {
    const trans = this.getTranslationsByKey(key, shadow, locale)
    return trans[locale]
  }

  getShadowLocales(node: LocaleNode, listedLocales?: string[]) {
    const locales: Record<string, LocaleRecord> = {}

    listedLocales = listedLocales || Global.getVisibleLocales(this.locales)

    listedLocales.forEach((locale) => {
      if (node.locales[locale]) {
        // locales already exists
        locales[locale] = node.locales[locale]
      }
      else {
        // create shadow locale
        locales[locale] = new LocaleRecord({
          locale,
          value: '',
          shadow: true,
          keyname: node.keyname,
          keypath: node.keypath,
          meta: node.meta,
          filepath: undefined,
          readonly: node.readonly,
        })
      }
    })

    return locales
  }

  abstract write (pendings: PendingWrite | PendingWrite[]): Promise<void>

  canHandleWrites(pending: PendingWrite) {
    return false
  }

  searchKeyForTranslations(text: string, locale = Config.sourceLanguage) {
    return this.keys
      .find(i => this.getTranslationsByKey(i, false)?.[locale]?.value === text)
  }

  protected onDispose() {
    // Log.info(`🗑 Disposing loader "${this.name}"`)
    this._disposables.forEach(d => d.dispose())
    this._disposables = []
  }
}
