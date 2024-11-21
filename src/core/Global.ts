import { extname, resolve } from 'path'
import { workspace, commands, window, EventEmitter, Event, ExtensionContext, ConfigurationChangeEvent, TextDocument, WorkspaceFolder } from 'vscode'
import { uniq } from 'lodash'
import { slash } from '@antfu/utils'
import { isMatch } from 'micromatch'
import { ParsePathMatcher } from '../utils/PathMatcher'
import { EXT_NAMESPACE } from '../meta'
import { ConfigLocalesGuide } from '../commands/configLocalePaths'
import { AvailableParsers, DefaultEnabledParsers } from '../parsers'
import { Framework } from '../frameworks/base'
import { getEnabledFrameworks, getEnabledFrameworksByIds, getPackageDependencies } from '../frameworks'
import { checkNotification } from '../update-notification'
import { Reviews } from './Review'
import { CurrentFile } from './CurrentFile'
import { Config } from './Config'
import { DirStructure, OptionalFeatures, KeyStyle } from './types'
import { LocaleLoader } from './loaders/LocaleLoader'
import { Analyst } from './Analyst'
import { Telemetry, TelemetryKey } from './Telemetry'
import i18n from '~/i18n'
import { Log, getExtOfLanguageId, normalizeUsageMatchRegex } from '~/utils'
import { DetectionResult } from '~/core/types'

export class Global {
  private static _loaders: Record<string, LocaleLoader> = {}
  private static _rootpath: string
  private static _enabled = false
  private static _currentWorkspaceFolder: WorkspaceFolder

  static context: ExtensionContext
  static enabledFrameworks: Framework[] = []
  static reviews = new Reviews()

  // events
  private static _onDidChangeRootPath: EventEmitter<string> = new EventEmitter()
  private static _onDidChangeEnabled: EventEmitter<boolean> = new EventEmitter()
  private static _onDidChangeLoader: EventEmitter<LocaleLoader> = new EventEmitter()

  static readonly onDidChangeRootPath: Event<string> = Global._onDidChangeRootPath.event
  static readonly onDidChangeEnabled: Event<boolean> = Global._onDidChangeEnabled.event
  static readonly onDidChangeLoader: Event<LocaleLoader> = Global._onDidChangeLoader.event

  static async init(context: ExtensionContext) {
    this.context = context

    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => this.updateRootPath()))
    context.subscriptions.push(window.onDidChangeActiveTextEditor(() => this.updateRootPath()))
    context.subscriptions.push(workspace.onDidOpenTextDocument(() => this.updateRootPath()))
    context.subscriptions.push(workspace.onDidCloseTextDocument(() => this.updateRootPath()))
    context.subscriptions.push(workspace.onDidChangeConfiguration(e => this.update(e)))
    await this.updateRootPath()
  }

  // #region framework settings
  static resetCache() {
    this._cacheUsageMatchRegex = {}
  }

  private static _cacheUsageMatchRegex: Record<string, RegExp[]> = {}

  static getUsageMatchRegex(languageId?: string, filepath?: string): RegExp[] {
    if (Config._regexUsageMatch) {
      if (!this._cacheUsageMatchRegex.custom) {
        this._cacheUsageMatchRegex.custom = normalizeUsageMatchRegex([
          ...Config._regexUsageMatch,
          ...Config._regexUsageMatchAppend,
        ])
      }
      return this._cacheUsageMatchRegex.custom
    }
    else {
      const key = `${languageId}_${filepath}`
      if (!this._cacheUsageMatchRegex[key]) {
        this._cacheUsageMatchRegex[key] = normalizeUsageMatchRegex([
          ...this.enabledFrameworks.flatMap(f => f.getUsageMatchRegex(languageId, filepath)),
          ...Config._regexUsageMatchAppend,
        ])
      }
      return this._cacheUsageMatchRegex[key]
    }
  }

  static async requestKeyStyle(): Promise<KeyStyle> {
    // user setting
    if (Config._keyStyle !== 'auto')
      return Config._keyStyle

    // try to use frameworks preference
    for (const f of this.enabledFrameworks) {
      if (f.preferredKeystyle && f.preferredKeystyle !== 'auto')
        return f.preferredKeystyle
    }

    // prompt to select
    const result = await window.showQuickPick([{
      value: 'nested',
      label: i18n.t('prompt.keystyle_nested'),
      description: i18n.t('prompt.keystyle_nested_example'),
    }, {
      value: 'flat',
      label: i18n.t('prompt.keystyle_flat'),
      description: i18n.t('prompt.keystyle_flat_example'),
    }], {
      placeHolder: i18n.t('prompt.keystyle_select'),
    })

    if (!result) {
      Config._keyStyle = 'nested'
      return 'nested'
    }
    Config._keyStyle = result.value as KeyStyle
    return result.value as KeyStyle
  }

  static interpretRefactorTemplates(keypath: string, args?: string[], document?: TextDocument, detection?: DetectionResult) {
    const path = slash(document?.uri.fsPath || '')
    const root = workspace.workspaceFolders?.[0]?.uri.fsPath
    const customTemplates = Config.refactorTemplates
      .filter((i) => {
        if (i.source && i.source !== detection?.source)
          return false
        if (i.exclude || i.include) {
          if (!path || !root)
            return false
          if (i.exclude && isMatch(path, i.exclude.map(i => slash(resolve(root, i)))))
            return false
          if (i.include && !isMatch(path, i.include.map(i => slash(resolve(root, i)))))
            return false
        }
        return true
      })
    const argsString = args?.length ? `${args?.join(',')}` : ''

    const customReplacers = customTemplates
      .flatMap(i => i.templates)
      .map(i => i
        .replace(/{key}/, keypath)
        .replace(/{args}/, argsString),
      )

    const frameworkReplacers = this.enabledFrameworks
      .flatMap(f => f.refactorTemplates(keypath, args, document, detection))

    return uniq([
      ...customReplacers,
      ...frameworkReplacers,
    ])
  }

  static isLanguageIdSupported(languageId: string) {
    return this.enabledFrameworks
      .flatMap(f => f.languageIds as string[])
      .includes(languageId)
  }

  static getSupportLangGlob() {
    const exts = uniq(this.enabledFrameworks
      .flatMap(f => f.languageIds)
      .flatMap(id => getExtOfLanguageId(id)))

    if (!exts.length)
      return ''
    else if (exts.length === 1)
      return `**/*.${exts[0]}`
    else
      return `**/*.{${exts.join(',')}}`
  }

  static getNamespaceDelimiter() {
    for (const f of this.enabledFrameworks) {
      if (f.namespaceDelimiter)
        return f.namespaceDelimiter
    }

    return '.'
  }

  static get derivedKeyRules() {
    const rules = Config.usageDerivedKeyRules
      ? Config.usageDerivedKeyRules
      : this.enabledFrameworks
        .flatMap(f => f.derivedKeyRules || [])

    return uniq(rules)
      .map((rule) => {
        const reg = rule
          .replace(/\./g, '\\.')
          .replace(/{key}/, '(.+)')

        return new RegExp(`^${reg}$`)
      })
  }

  static getDocumentSelectors() {
    return this.enabledFrameworks
      .flatMap(f => f.languageIds)
      .map(id => ({ scheme: 'file', language: id }))
  }

  static get enabledParserExts() {
    return this.enabledParsers
      .flatMap(f => [
        f.supportedExts,
        Object.entries(Config.parsersExtendFileExtensions)
          .find(([, v]) => v === f.id)?.[0],
      ])
      .filter(Boolean)
      .join('|')
  }

  static get dirStructure() {
    let config = Config._dirStructure
    if (!config || config === 'auto') {
      for (const f of this.enabledFrameworks) {
        if (f.preferredDirStructure)
          config = f.preferredDirStructure
      }
    }
    return config
  }

  static getPathMatchers(dirStructure: DirStructure) {
    const rules = Config._pathMatcher
      ? [Config._pathMatcher]
      : this.enabledFrameworks
        .flatMap(f => f.pathMatcher(dirStructure))

    return uniq(rules)
      .map(matcher => ({
        regex: ParsePathMatcher(matcher, this.enabledParserExts),
        matcher,
      }))
  }

  static hasFeatureEnabled(name: keyof OptionalFeatures) {
    return this.enabledFrameworks
      .map(i => i.enableFeatures)
      .filter(i => i)
      .some(i => i && i[name])
  }

  static get namespaceEnabled() {
    return Config.namespace || this.hasFeatureEnabled('namespace')
  }

  static get localesPaths(): string[] | undefined {
    let config

    if (this._currentWorkspaceFolder)
      config = Config.getLocalesPathsInScope(this._currentWorkspaceFolder)
    else
      config = Config._localesPaths

    if (!config) {
      config = this.enabledFrameworks.flatMap(f => f.preferredLocalePaths || [])
      if (!config.length)
        config = undefined
    }
    return config
  }

  // #endregion

  static get rootpath() {
    return this._rootpath
  }

  private static async initLoader(rootpath: string, reload = false) {
    if (!rootpath)
      return

    // if (Config.debug)
    //  clearNotificationState(this.context)
    checkNotification(this.context)

    if (this._loaders[rootpath] && !reload)
      return this._loaders[rootpath]

    const loader = new LocaleLoader(rootpath)
    await loader.init()
    this.context.subscriptions.push(loader.onDidChange(() => this._onDidChangeLoader.fire(loader)))
    this.context.subscriptions.push(loader)
    this._loaders[rootpath] = loader

    return this._loaders[rootpath]
  }

  private static async updateRootPath() {
    const editor = window.activeTextEditor
    let rootpath = ''

    if (!editor || !workspace.workspaceFolders || workspace.workspaceFolders.length === 0)
      return

    const resource = editor.document.uri
    if (resource.scheme === 'file') {
      const folder = workspace.getWorkspaceFolder(resource)
      if (folder) {
        this._currentWorkspaceFolder = folder
        rootpath = folder.uri.fsPath
      }
    }

    if (!rootpath && workspace.rootPath)
      rootpath = workspace.rootPath

    if (rootpath && rootpath !== this._rootpath) {
      this._rootpath = rootpath

      Log.divider()
      Log.info(`💼 Workspace root changed to "${rootpath}"`)

      await this.update()
      this._onDidChangeRootPath.fire(rootpath)
      this.reviews.init(rootpath)
    }
  }

  static async update(e?: ConfigurationChangeEvent) {
    this.resetCache()

    let reload = false
    if (e) {
      let affected = false

      for (const config of Config.reloadConfigs) {
        const key = `${EXT_NAMESPACE}.${config}`
        if (e.affectsConfiguration(key)) {
          affected = true
          reload = true
          Log.info(`🧰 Config "${key}" changed, reloading`)
          break
        }
      }

      for (const config of Config.refreshConfigs) {
        const key = `${EXT_NAMESPACE}.${config}`
        if (e.affectsConfiguration(key)) {
          affected = true
          Log.info(`🧰 Config "${key}" changed`)
          break
        }
      }

      for (const config of Config.usageRefreshConfigs) {
        const key = `${EXT_NAMESPACE}.${config}`
        if (e.affectsConfiguration(key)) {
          Analyst.refresh()

          Log.info(`🧰 Config "${key}" changed`)
          break
        }
      }

      if (!affected)
        return

      if (reload)
        Log.info('🔁 Reloading loader')
    }

    if (!Config.enabledFrameworks) {
      const packages = getPackageDependencies(this._rootpath)
      this.enabledFrameworks = getEnabledFrameworks(packages, this._rootpath)
    }
    else {
      const frameworks = Config.enabledFrameworks
      this.enabledFrameworks = getEnabledFrameworksByIds(frameworks, this._rootpath)
    }
    const isValidProject = this.enabledFrameworks.length > 0 && this.enabledParsers.length > 0
    const hasLocalesSet = !!Global.localesPaths
    const shouldEnabled = !Config.disabled && isValidProject && hasLocalesSet
    this.setEnabled(shouldEnabled)

    if (this.enabled) {
      Log.info(`🧩 Enabled frameworks: ${this.enabledFrameworks.map(i => i.display).join(', ')}`)
      Log.info(`🧬 Enabled parsers: ${this.enabledParsers.map(i => i.id).join(', ')}`)
      Log.info('')
      commands.executeCommand('setContext', 'i18n-ally.extract.autoDetect', Config.extractAutoDetect)

      Telemetry.track(TelemetryKey.Enabled)

      await this.initLoader(this._rootpath, reload)
    }
    else {
      if (!Config.disabled) {
        if (!isValidProject && hasLocalesSet)
          Log.info('⚠ Current workspace is not a valid project, extension disabled')

        if (isValidProject && !hasLocalesSet && Config.autoDetection)
          ConfigLocalesGuide.autoSet()
      }

      this.unloadAll()
    }

    this._onDidChangeLoader.fire(this.loader)
  }

  private static unloadAll() {
    Object.values(this._loaders).forEach(loader => loader.dispose())
    this._loaders = {}
  }

  static get loader() {
    return this._loaders[this._rootpath]
  }

  static get enabledParsers() {
    let ids = Config.enabledParsers?.length
      ? Config.enabledParsers
      : this.enabledFrameworks
        .flatMap(f => f.enabledParsers || [])

    if (!ids.length)
      ids = DefaultEnabledParsers

    return AvailableParsers.filter(i => ids.includes(i.id))
  }

  static getMatchedParser(ext: string) {
    if (!ext.startsWith('.') && ext.includes('.'))
      ext = extname(ext)

    // resolve custom parser extensions
    const id = Config.parsersExtendFileExtensions[ext.slice(1)]
    if (id)
      return this.enabledParsers.find(parser => parser.id === id)

    // resolve parser
    return this.enabledParsers.find(parser => parser.supports(ext))
  }

  // enables
  static get enabled() {
    return this._enabled
  }

  private static setEnabled(value: boolean) {
    if (this._enabled !== value) {
      Log.info(value ? '🌞 Enabled' : '🌚 Disabled')
      this._enabled = value
      commands.executeCommand('setContext', `${EXT_NAMESPACE}-enabled`, value)
      this._onDidChangeEnabled.fire(this._enabled)
    }
  }

  static get allLocales() {
    return CurrentFile.loader.locales
  }

  static get visibleLocales() {
    return this.getVisibleLocales(this.allLocales)
  }

  static getVisibleLocales(locales: string[]) {
    const ignored = Config.ignoredLocales
    return locales.filter(locale => !ignored.includes(locale))
  }

  static getExtractionFrameworksByLang(languageId: string) {
    return this.enabledFrameworks.filter(i => i.supportAutoExtraction?.includes(languageId))
  }
}
