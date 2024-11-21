import { TextDocument, Position, Range, ExtensionContext, workspace } from 'vscode'
import { Global } from './Global'
import { RewriteKeyContext } from './types'
import { Config } from './Config'
import { Loader } from './loaders/Loader'
import { ScopeRange } from '~/frameworks'
import { regexFindKeys } from '~/utils'
import { KeyInDocument, CurrentFile } from '~/core'

export interface KeyUsages {
  type: 'code'| 'locale'
  keys: KeyInDocument[]
  locale: string
  namespace?: string
}

export class KeyDetector {
  static getKeyByContent(text: string) {
    const keys = new Set<string>()
    const regs = Global.getUsageMatchRegex()

    for (const reg of regs) {
      (text.match(reg) || [])
        .forEach(key =>
          keys.add(key.replace(reg, '$1')),
        )
    }

    return Array.from(keys)
  }

  static getKeyRange(document: TextDocument, position: Position, dotEnding?: boolean) {
    if (Config.disablePathParsing)
      dotEnding = true

    const regs = Global.getUsageMatchRegex(document.languageId, document.uri.fsPath)
    for (const regex of regs) {
      const range = document.getWordRangeAtPosition(position, regex)
      if (range) {
        const key = document.getText(range).replace(regex, '$1')

        if (dotEnding) {
          if (!key || key.endsWith('.'))
            return { range, key }
        }
        else {
          return { range, key }
        }
      }
    }
  }

  static getKey(document: TextDocument, position: Position, dotEnding?: boolean) {
    const keyRange = KeyDetector.getKeyRange(document, position, dotEnding)
    return keyRange?.key
  }

  static getScopedKey(document: TextDocument, position: Position) {
    const scopes = Global.enabledFrameworks.flatMap(f => f.getScopeRange(document) || [])
    if (scopes.length > 0) {
      const offset = document.offsetAt(position)
      return scopes.filter(s => s.start < offset && offset < s.end).map(s => s.namespace).join('.')
    }
  }

  static getKeyAndRange(document: TextDocument, position: Position, dotEnding?: boolean) {
    const { range, key } = KeyDetector.getKeyRange(document, position, dotEnding) || {}
    if (!range || !key)
      return

    const end = range.end.character - 1
    const start = end - key.length
    const keyRange = new Range(
      new Position(range.end.line, start),
      new Position(range.end.line, end),
    )
    return {
      range: keyRange,
      key,
    }
  }

  static init(ctx: ExtensionContext) {
    workspace.onDidChangeTextDocument(
      (e) => {
        delete this._get_keys_cache[e.document.uri.fsPath]
      },
      null,
      ctx.subscriptions,
    )
  }

  private static _get_keys_cache: Record<string, KeyInDocument[]> = {}

  static getKeys(document: TextDocument | string, regs?: RegExp[], dotEnding?: boolean, scopes?: ScopeRange[]): KeyInDocument[] {
    let text = ''
    let rewriteContext: RewriteKeyContext| undefined
    let filepath = ''
    if (typeof document !== 'string') {
      filepath = document.uri.fsPath
      if (this._get_keys_cache[filepath])
        return this._get_keys_cache[filepath]

      regs = regs ?? Global.getUsageMatchRegex(document.languageId, filepath)
      text = document.getText()
      rewriteContext = {
        targetFile: filepath,
      }
      scopes = scopes || Global.enabledFrameworks.flatMap(f => f.getScopeRange(document) || [])
    }
    else {
      regs = Global.getUsageMatchRegex()
      text = document
    }

    const keys = regexFindKeys(text, regs, dotEnding, rewriteContext, scopes)
    if (filepath)
      this._get_keys_cache[filepath] = keys
    return keys
  }

  static getUsages(document: TextDocument, loader?: Loader): KeyUsages | undefined {
    if (loader == null)
      loader = CurrentFile.loader

    let keys: KeyInDocument[] = []
    let locale = Config.displayLanguage
    let namespace: string | undefined
    let type: 'locale' | 'code' = 'code'
    const filepath = document.uri.fsPath

    // locale file
    const localeFile = loader.files.find(f => f?.filepath === filepath)
    if (localeFile) {
      type = 'locale'
      const parser = Global.enabledParsers.find(p => p.annotationLanguageIds.includes(document.languageId))
      if (!parser)
        return

      if (Global.namespaceEnabled)
        namespace = loader.getNamespaceFromFilepath(filepath)

      locale = localeFile.locale
      keys = parser.annotationGetKeys(document)
        .filter(({ key }) => loader!.getTreeNodeByKey(key)?.type === 'node')
    }
    // code
    else if (Global.isLanguageIdSupported(document.languageId)) {
      keys = KeyDetector.getKeys(document)
    }
    else {
      return
    }

    return {
      type,
      keys,
      locale,
      namespace,
    }
  }
}
