/* eslint-disable @typescript-eslint/no-unused-vars */
import { TextDocument } from 'vscode'
import { LanguageId } from '~/utils'
import { DirStructure, OptionalFeatures, RewriteKeySource, RewriteKeyContext, DataProcessContext, KeyStyle, Config } from '~/core'
import { DetectionResult } from '~/core/types'

export type FrameworkDetectionDefine = string[] | { none?: string[]; every?: string[]; any?: string[] } | ((packages: string[], root: string) => boolean)

export type PackageFileType
= 'packageJSON'
| 'pubspecYAML'
| 'composerJSON'
| 'gemfile'
| 'none'

export interface ScopeRange {
  start: number
  end: number
  namespace: string
  keyPrefix?: string
}

export abstract class Framework {
  abstract id: string
  abstract display: string
  monopoly?: boolean
  enabledParsers?: string[]
  derivedKeyRules?: string[]
  namespaceDelimiter?: string
  supportAutoExtraction?: string[]

  /**
   * Packages names determine whether a frameworks should enable or not
   */
  abstract detection: Partial<Record<PackageFileType, FrameworkDetectionDefine>>

  /**
   * Language Ids to enables annotations
   */
  abstract languageIds: LanguageId[]

  /**
   * Array of regex for detect keys in document
   */
  abstract usageMatchRegex: string | RegExp | (string | RegExp)[] | ((languageId?: string, filepath?: string) => string | RegExp | (string | RegExp)[])

  /**
   * Return possible choices of replacement for messages extracted from code
   */
  abstract refactorTemplates (keypath: string, args?: string[], document?: TextDocument, detection?: DetectionResult): string[]

  /**
   * Analysis the file and get hard strings
   */
  detectHardStrings(document: TextDocument): DetectionResult[] | undefined {
    return undefined
  }

  /**
   * Tell the key dector how to add prefix scopes
   */
  getScopeRange(document: TextDocument): ScopeRange[] | undefined {
    return undefined
  }

  /**
   * Locale file's name match
   */
  pathMatcher(dirStructure?: DirStructure): string {
    if (dirStructure === 'file')
      return '{locale}.{ext}'
    else if (Config.namespace)
      return '{locale}/**/{namespace}.{ext}'
    else
      return '{locale}/**/*.{ext}'
  }

  preferredLocalePaths?: string[]

  preferredKeystyle?: KeyStyle

  preferredDirStructure?: DirStructure

  enableFeatures?: OptionalFeatures

  getUsageMatchRegex(languageId = '*', filepath?: string) {
    let reg: string | RegExp | (string | RegExp)[] | undefined
    if (typeof this.usageMatchRegex === 'function')
      reg = this.usageMatchRegex(languageId, filepath)
    else
      reg = this.usageMatchRegex
    return reg
  }

  rewriteKeys(key: string, source: RewriteKeySource, context: RewriteKeyContext = {}) {
    return key
  }

  preprocessData(data: object, context: DataProcessContext): object {
    return data
  }

  deprocessData(data: object, context: DataProcessContext): object {
    return data
  }
}
