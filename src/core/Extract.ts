import { basename, extname } from 'path'
import { TextDocument, window } from 'vscode'
import { nanoid } from 'nanoid'
import limax from 'limax'
import { Config, Global } from '../extension'
import { ExtractInfo } from './types'
import { CurrentFile } from './CurrentFile'
import { changeCase } from '~/utils/changeCase'

export function generateKeyFromText(text: string, filepath?: string, reuseExisting = false, usedKeys: string[] = []): string {
  let key: string | undefined

  // already existed, reuse the key
  // mostly for auto extraction
  if (reuseExisting) {
    key = Global.loader.searchKeyForTranslations(text)
    if (key)
      return key
  }

  // keygent
  const keygenStrategy = Config.keygenStrategy
  if (keygenStrategy === 'random') {
    key = nanoid()
  }
  else if (keygenStrategy === 'empty') {
    key = ''
  }
  else if (keygenStrategy === 'source') {
    key = text
  }
  else {
    text = text.replace(/\$/g, '')
    key = limax(text, { separator: Config.preferredDelimiter, tone: false })
      .slice(0, Config.extractKeyMaxLength ?? Infinity)
  }

  key = changeCase(key, Config.keygenStyle)

  let keyPrefix = Config.keyPrefix
  if (keyPrefix && keygenStrategy !== 'empty' && keygenStrategy !== 'source') {
    if (filepath && keyPrefix.includes('fileName')) {
      keyPrefix = keyPrefix
        .replace('{fileName}', changeCase(basename(filepath), Config.keygenStyle))
        .replace('{fileNameWithoutExt}', changeCase(basename(filepath, extname(filepath)), Config.keygenStyle))
    }

    key = keyPrefix + key
  }

  key = key.trim()

  // some symbol can't convert to alphabet correctly, apply a default key to it
  if (!key)
    key = 'key'

  // suffix with a auto increment number if same key
  if (usedKeys.includes(key) || CurrentFile.loader.getNodeByKey(key)) {
    const originalKey = key
    let num = 0

    do {
      key = `${originalKey}${Config.preferredDelimiter}${num}`
      num += 1
    } while (
      usedKeys.includes(key) || CurrentFile.loader.getNodeByKey(key, false)
    )
  }

  return key
}

export async function extractHardStrings(document: TextDocument, extracts: ExtractInfo[], saveFile = false) {
  if (!extracts.length)
    return

  const editor = await window.showTextDocument(document)
  const filepath = document.uri.fsPath
  const sourceLanguage = Config.sourceLanguage

  extracts.sort((a, b) => b.range.start.compareTo(a.range.start))

  // replace
  await editor.edit((editBuilder) => {
    for (const extract of extracts) {
      editBuilder.replace(
        extract.range,
        extract.replaceTo,
      )
    }
  })

  // save keys
  await CurrentFile.loader.write(
    extracts
      .filter(i => i.keypath != null && i.message != null)
      .map(e => ({
        textFromPath: filepath,
        filepath: undefined,
        keypath: e.keypath!,
        value: e.message!,
        locale: e.locale || sourceLanguage,
      })),
  )

  if (saveFile)
    await document.save()

  CurrentFile.invalidate()
}
