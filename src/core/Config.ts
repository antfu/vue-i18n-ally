import path from 'path'
import { execSync } from 'child_process'
import { workspace, extensions, ExtensionContext, commands, ConfigurationScope, WorkspaceFolder } from 'vscode'
import { trimEnd, uniq } from 'lodash'
import { TagSystems } from '../tagSystems'
import { EXT_NAMESPACE, EXT_ID, EXT_LEGACY_NAMESPACE, KEY_REG_DEFAULT, KEY_REG_ALL, DEFAULT_LOCALE_COUNTRY_MAP } from '../meta'
import { KeyStyle, DirStructureAuto, SortCompare, TargetPickingStrategy } from '.'
import i18n from '~/i18n'
import { CaseStyles } from '~/utils/changeCase'
import { ExtractionBabelOptions, ExtractionHTMLOptions } from '~/extraction/parsers/options'
import { resolveRefactorTemplate } from '~/utils/resolveRefactorTemplate'

export class Config {
  static readonly reloadConfigs = [
    'disabled',
    'localesPaths',
    'pathMatcher',
    'includeSubfolders',
    'enabledFrameworks',
    'enabledParsers',
    'dirStructure',
    'encoding',
    'namespace',
    'defaultNamespace',
    'disablePathParsing',
    'readonly',
    'languageTagSystem',
    'ignoreFiles',
    'parserOptions',
    'parsers.extendFileExtensions',
  ]

  static readonly refreshConfigs = [
    'sourceLanguage',
    'ignoredLocales',
    'displayLanguage',
    'regex.key',
    'regex.usageMatch',
    'regex.usageMatchAppend',
  ]

  static readonly usageRefreshConfigs = [
    'keysInUse',
    'derivedKeyRules',
  ]

  static ctx: ExtensionContext

  static get root() {
    return workspace.rootPath!
  }

  static get disabled() {
    return Config.getConfig<boolean>('disabled') ?? false
  }

  static get autoDetection() {
    return Config.getConfig<boolean>('autoDetection') ?? true
  }

  // languages
  static get displayLanguage(): string {
    return this.normalizeLocale(Config.getConfig<string>('displayLanguage') || '')
  }

  static set displayLanguage(value) {
    this.setConfig('displayLanguage', value, true)
  }

  static get sourceLanguage(): string {
    return this.normalizeLocale(this.getConfig<string>('sourceLanguage') || '', '') || this.displayLanguage || 'en'
  }

  static set sourceLanguage(value) {
    this.setConfig('sourceLanguage', this.normalizeLocale(value))
  }

  static get tagSystem() {
    const tag = this.getConfig('languageTagSystem') || 'bcp47'
    return TagSystems[tag]
  }

  static normalizeLocale(locale: string, fallback?: string, strict?: boolean) {
    return this.tagSystem.normalize(locale, fallback, strict)
  }

  static getBCP47(locale: string) {
    return this.tagSystem.toBCP47(this.tagSystem.normalize(locale))
  }

  static get ignoredLocales(): string[] {
    const ignored = this.getConfig('ignoredLocales')
    if (!ignored)
      return []
    if (ignored && typeof ignored === 'string')
      return [ignored]
    if (Array.isArray(ignored))
      return ignored
    return []
  }

  static set ignoredLocales(value) {
    this.setConfig('ignoredLocales', value, true)
  }

  static get _keyStyle(): KeyStyle {
    const style = this.getConfig<KeyStyle>('keystyle') || 'auto'
    if (style === 'auto' && this.disablePathParsing)
      return 'flat'
    return style
  }

  static set _keyStyle(value: KeyStyle) {
    this.setConfig('keystyle', value, false)
  }

  static get annotations(): boolean {
    return this.getConfig<boolean>('annotations') ?? true
  }

  static set annotations(value: boolean) {
    this.setConfig('annotations', value, true)
  }

  static get annotationMaxLength(): number {
    return this.getConfig<number>('annotationMaxLength') || 40
  }

  static set annotationMaxLength(value: number) {
    this.setConfig('annotationMaxLength', value, true)
  }

  static get annotationDelimiter(): string {
    return this.getConfig<string>('annotationDelimiter') || ''
  }

  static get annotationInPlace(): boolean {
    return this.getConfig<boolean>('annotationInPlace') ?? true
  }

  static get namespace(): boolean | undefined {
    return this.getConfig<boolean>('namespace')
  }

  static get defaultNamespace(): string | undefined {
    return this.getConfig<string>('defaultNamespace')
  }

  static get enabledFrameworks(): string[] | undefined {
    let ids = this.getConfig<string | string[]>('enabledFrameworks')
    if (!ids || !ids.length)
      return undefined
    if (typeof ids === 'string')
      ids = [ids]
    return ids
  }

  static get enabledParsers(): string[] | undefined {
    let ids = this.getConfig<string | string[]>('enabledParsers')
    if (!ids || !ids.length)
      return undefined
    if (typeof ids === 'string')
      ids = [ids]
    return ids
  }

  static get _dirStructure(): DirStructureAuto {
    return (this.getConfig('dirStructure')) as (DirStructureAuto) || 'auto'
  }

  static set _dirStructure(value: DirStructureAuto) {
    this.setConfig('dirStructure', value, true)
  }

  static get sortKeys(): boolean {
    return this.getConfig<boolean>('sortKeys') || false
  }

  static get sortCompare(): SortCompare {
    return this.getConfig<SortCompare>('sortCompare') || 'binary'
  }

  static get sortLocale(): string | undefined{
    return this.getConfig<string>('sortLocale')
  }

  static get readonly(): boolean {
    return this.getConfig<boolean>('readonly') || false
  }

  static get includeSubfolders(): boolean {
    return this.getConfig<boolean>('includeSubfolders') || false
  }

  static get fullReloadOnChanged(): boolean {
    return this.getConfig<boolean>('fullReloadOnChanged') || false
  }

  static get preferredDelimiter(): string {
    return this.getConfig<string>('preferredDelimiter') || '-'
  }

  static get _pathMatcher(): string | undefined {
    return this.getConfig('pathMatcher')
  }

  static get regexKey(): string {
    return this.getConfig('regex.key')
      || this.getConfig('keyMatchRegex') // back compatible, deprecated.
      || (Config.disablePathParsing ? KEY_REG_ALL : KEY_REG_DEFAULT)
  }

  static get _regexUsageMatch(): string[] | undefined {
    const config = this.getConfig<string[]>('regex.usageMatch')
    if (config && config.length)
      return config
  }

  static get _regexUsageMatchAppend(): string[] {
    return this.getConfig<string[]>('regex.usageMatchAppend') || []
  }

  static get keepFulfilled(): boolean {
    return this.getConfig<boolean>('keepFulfilled') || false
  }

  static get translateFallbackToKey(): boolean {
    return this.getConfig<boolean>('translate.fallbackToKey') || false
  }

  static get translateSaveAsCandidates(): boolean {
    return this.getConfig<boolean>('translate.saveAsCandidates') || false
  }

  static get frameworksRubyRailsScopeRoot(): string {
    return this.getConfig<string>('frameworks.ruby-rails.scopeRoot') || ''
  }

  static get parsersTypescriptTsNodePath(): string {
    const config = this.getConfig<string>('parsers.typescript.tsNodePath')!
    if (config === 'ts-node')
      return config

    return `node "${path.resolve(this.extensionPath!, config)}"`
  }

  static get parsersTypescriptCompilerOption(): any {
    return this.getConfig<any>('parsers.typescript.compilerOptions') || {}
  }

  static get parsersExtendFileExtensions(): any {
    return this.getConfig<any>('parsers.extendFileExtensions') || {}
  }

  static toggleLocaleVisibility(locale: string, visible?: boolean) {
    const ignored = this.ignoredLocales
    if (visible == null)
      visible = !ignored.includes(locale)
    if (!visible) {
      ignored.push(locale)
      this.ignoredLocales = ignored
    }
    else {
      this.ignoredLocales = ignored.filter(i => i !== locale)
    }
  }

  // locales
  static get _localesPaths(): string[] | undefined {
    const paths = this.getConfig('localesPaths')
    let localesPaths: string[]
    if (!paths)
      return
    else if (typeof paths === 'string')
      localesPaths = paths.split(',')
    else
      localesPaths = paths
    if (!localesPaths)
      return
    return localesPaths.map(i => trimEnd(i, '/\\').replace(/\\/g, '/'))
  }

  static set _localesPaths(paths: string[] | undefined) {
    this.setConfig('localesPaths', paths)
  }

  static getLocalesPathsInScope(scope: WorkspaceFolder): string[] | undefined {
    const paths = this.getConfig('localesPaths', scope)

    let localesPaths: string[]
    if (!paths)
      return
    else if (typeof paths === 'string')
      localesPaths = paths.split(',')
    else
      localesPaths = paths
    if (!localesPaths)
      return
    return localesPaths.map(i => trimEnd(i, '/\\').replace(/\\/g, '/'))
  }

  static updateLocalesPaths(paths: string[]) {
    this._localesPaths = uniq((this._localesPaths || []).concat(paths))
  }

  static get themeAnnotation(): string {
    return this.getConfig<string>('theme.annotation')!
  }

  static get themeAnnotationMissing(): string {
    return this.getConfig<string>('theme.annotationMissing')!
  }

  static get themeAnnotationBorder(): string {
    return this.getConfig<string>('theme.annotationBorder')!
  }

  static get themeAnnotationMissingBorder(): string {
    return this.getConfig<string>('theme.annotationMissingBorder')!
  }

  static get extension() {
    return extensions.getExtension(EXT_ID)
  }

  static get extensionPath() {
    return this.ctx.extensionPath
  }

  static get encoding() {
    return this.getConfig<string>('encoding') || 'utf-8'
  }

  static get indent() {
    return this.getConfig<number>('indent') ?? 2
  }

  static get tabStyle() {
    return this.getConfig<string>('tabStyle') === 'tab' ? '\t' : ' '
  }

  static get translatePromptSource() {
    return this.getConfig<boolean>('translate.promptSource') ?? false
  }

  static get translateParallels() {
    return this.getConfig<number>('translate.parallels') || 5
  }

  static get translateEngines() {
    return this.getConfig<string[]>('translate.engines') || ['google']
  }

  static get refactorTemplates() {
    return resolveRefactorTemplate(this.getConfig<string[]>('refactor.templates') || [])
  }

  static get disablePathParsing() {
    return this.getConfig<boolean>('disablePathParsing') ?? false
  }

  static get ignoreFiles() {
    return this.getConfig<string[]>('ignoreFiles') ?? []
  }

  static get keysInUse() {
    return this.getConfig<string[]>('keysInUse') || []
  }

  static set keysInUse(value) {
    this.setConfig('keysInUse', value)
  }

  static get usageDerivedKeyRules() {
    return this.getConfig<string[]>('usage.derivedKeyRules')
    ?? this.getConfig<string[]>('derivedKeyRules') // back compatible, deprecated.
    ?? undefined
  }

  static get usageScanningIgnore() {
    return this.getConfig<string[]>('usage.scanningIgnore') || []
  }

  static get preferEditor() {
    return this.getConfig<boolean>('editor.preferEditor') || false
  }

  static get reviewEnabled() {
    return this.getConfig<boolean>('review.enabled') ?? true
  }

  static get reviewGutters() {
    return this.getConfig<boolean>('review.gutters') ?? true
  }

  private static _reviewUserName: string | undefined
  static get reviewUserName() {
    const config = this.getConfig<string>('review.user.name')
    if (config)
      return config
    if (!Config._reviewUserName) {
      try {
        Config._reviewUserName = execSync('git config user.name').toString().trim()
      }
      catch (e) {
        return i18n.t('review.unknown_user')
      }
    }

    return Config._reviewUserName
  }

  private static _reviewUserEmail: string | undefined

  static get reviewUserEmail() {
    const config = this.getConfig<string>('review.user.email')
    if (config)
      return config
    if (!Config._reviewUserEmail) {
      try {
        Config._reviewUserEmail = execSync('git config user.email').toString().trim()
      }
      catch (e) {
        return ''
      }
    }

    return Config._reviewUserEmail
  }

  static get reviewUser() {
    return {
      name: Config.reviewUserName,
      email: Config.reviewUserEmail,
    }
  }

  static get reviewRemoveCommentOnResolved() {
    return this.getConfig<boolean>('review.removeCommentOnResolved') ?? false
  }

  static get translateOverrideExisting() {
    return this.getConfig<boolean>('translate.overrideExisting') ?? false
  }

  static get keygenStrategy() {
    return this.getConfig<string>('extract.keygenStrategy') ?? 'slug'
  }

  static get keygenStyle(): CaseStyles {
    return this.getConfig<CaseStyles>('extract.keygenStyle') ?? 'default'
  }

  static get keyPrefix() {
    return this.getConfig<string>('extract.keyPrefix') ?? ''
  }

  static get extractKeyMaxLength() {
    return this.getConfig<number>('extract.keyMaxLength') ?? Infinity
  }

  static get extractAutoDetect() {
    return this.getConfig<boolean>('extract.autoDetect') ?? false
  }

  static set extractAutoDetect(v: boolean) {
    this.setConfig('extract.autoDetect', v, false)
    commands.executeCommand('setContext', 'i18n-ally.extract.autoDetect', v)
  }

  static get extractParserHTMLOptions() {
    return this.getConfig<ExtractionHTMLOptions>('extract.parsers.html') ?? {}
  }

  static get extractParserBabelOptions() {
    return this.getConfig<ExtractionBabelOptions>('extract.parsers.babel') ?? {}
  }

  static get extractIgnored() {
    return this.getConfig<string[]>('extract.ignored') ?? []
  }

  static set extractIgnored(v) {
    this.setConfig('extract.ignored', v)
  }

  static get extractIgnoredByFiles() {
    return this.getConfig<Record<string, string[]>>('extract.ignoredByFiles') ?? {}
  }

  static set extractIgnoredByFiles(v) {
    this.setConfig('extract.ignoredByFiles', v)
  }

  static get showFlags() {
    return this.getConfig<boolean>('showFlags') ?? true
  }

  static get parserOptions() {
    return this.getConfig<any>('parserOptions') ?? {}
  }

  static get localeCountryMap() {
    return Object.assign(
      DEFAULT_LOCALE_COUNTRY_MAP,
      this.getConfig<Record<string, string>>('localeCountryMap'),
    )
  }

  static get targetPickingStrategy(): TargetPickingStrategy {
    return this.getConfig<TargetPickingStrategy | undefined>('extract.targetPickingStrategy')
      ?? TargetPickingStrategy.None
  }

  // config
  private static getConfig<T = any>(key: string, scope?: ConfigurationScope | undefined): T | undefined {
    let config = workspace
      .getConfiguration(EXT_NAMESPACE, scope)
      .get<T>(key)

    // compatible to vue-i18n-ally
    if (config === undefined) {
      config = workspace
        .getConfiguration(EXT_LEGACY_NAMESPACE)
        .get<T>(key)
    }

    return config
  }

  private static async setConfig(key: string, value: any, isGlobal = false) {
    // transfer legacy config
    if (workspace
      .getConfiguration(EXT_LEGACY_NAMESPACE)
      .get<any>(key)
    ) {
      await workspace.getConfiguration(EXT_LEGACY_NAMESPACE)
        .update(key, undefined, isGlobal)
    }

    // update value
    return await workspace
      .getConfiguration(EXT_NAMESPACE)
      .update(key, value, isGlobal)
  }

  static get baiduApiSecret() {
    return this.getConfig<string | null | undefined>('translate.baidu.apiSecret')
  }

  static get baiduAppid() {
    return this.getConfig<string | null | undefined>('translate.baidu.appid')
  }

  static get googleApiKey() {
    return this.getConfig<string | null | undefined>('translate.google.apiKey')
  }

  static get deeplApiKey() {
    return this.getConfig<string | null | undefined>('translate.deepl.apiKey')
  }

  static get deeplUseFreeApiEntry() {
    return this.getConfig<boolean>('translate.deepl.useFreeApiEntry')
  }

  static get deeplLog(): boolean {
    return !!this.getConfig('translate.deepl.enableLog')
  }

  static get deeplGlossariesDir() {
    return this.getConfig<string|null|undefined>('translate.deepl.glossariesDir');
  }

  static get libreTranslateApiRoot() {
    return this.getConfig<string | null | undefined>('translate.libre.apiRoot')
  }

  static get openaiApiKey() {
    return this.getConfig<string | null | undefined>('translate.openai.apiKey')
  }

  static get openaiApiRoot() {
    return this.getConfig<string | null | undefined>('translate.openai.apiRoot')
  }

  static get openaiApiModel() {
    return this.getConfig<string>('translate.openai.apiModel') ?? 'gpt-3.5-turbo'
  }

  static get telemetry(): boolean {
    return workspace.getConfiguration().get('telemetry.enableTelemetry') as boolean
  }
}
