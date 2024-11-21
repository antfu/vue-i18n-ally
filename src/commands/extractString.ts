import { relative } from 'path'
import { commands, window, QuickPickItem, Range, TextDocument } from 'vscode'
import { trim } from 'lodash'
import { overrideConfirm } from './overrideConfirm'
import { Commands } from './commands'
import { keypathValidate, Log, preSufArgString, promptTemplates } from '~/utils'
import { ExtensionModule } from '~/modules'
import { extractHardStrings, generateKeyFromText, Config, CurrentFile, DetectionResult, Telemetry, TelemetryKey } from '~/core'
import i18n from '~/i18n'

import { parseHardString } from '~/extraction/parseHardString'

interface QuickPickItemWithKey extends QuickPickItem {
  keypath: string
  type: 'tree' | 'node' | 'new' | 'existed'
}

export interface ExtractTextOptions {
  text: string
  rawText?: string
  args?: string[]
  range: Range
  isDynamic?: boolean
  document: TextDocument
  isInsert?: boolean
}

async function ExtractOrInsertCommnad(options?: ExtractTextOptions, detection?: DetectionResult) {
  Telemetry.track(TelemetryKey.ExtractString)

  if (Config.readonly) {
    Log.warn(i18n.t('errors.write_in_readonly_mode'), true)
    return
  }

  if (!options) {
    // execute from command palette, get from active document
    const editor = window.activeTextEditor
    const currentDoc = editor?.document
    if (!editor || !currentDoc)
      return

    options = {
      text: '',
      rawText: trim(currentDoc.getText(editor.selection), '\'"` '),
      range: editor.selection,
      document: currentDoc,
      isInsert: editor.selection.start.isEqual(editor.selection.end),
    }
  }

  const locale = Config.sourceLanguage
  const loader = CurrentFile.loader

  if (options.rawText && !options.text) {
    const result = parseHardString(options.rawText, options.document?.languageId, options.isDynamic, preSufArgString)
    options.text = result?.text || ''
    options.args = result?.args
  }

  const { text, rawText, range, args, document, isInsert } = options
  const filepath = document.uri.fsPath

  const default_keypath = generateKeyFromText(rawText || text, filepath)

  const existingItems: QuickPickItemWithKey[]
    = isInsert
      ? []
      : loader.keys
        .map(key => ({
          description: loader.getValueByKey(key, Config.sourceLanguage, 0),
          keypath: key,
        }))
        .filter(item => item.description === text)
        .map(i => ({
          ...i,
          label: `$(replace-all) ${i.keypath}`,
          type: 'existed' as const,
          alwaysShow: true,
          detail: i18n.t('prompt.existing_translation'),
        }))

  const getPickItems = (input?: string) => {
    const path = input?.split('.').slice(0, -1).join('.')

    const node = path
      ? (loader.getTreeNodeByKey(path))
      : CurrentFile.loader.root

    let items: QuickPickItemWithKey[] = []
    if (node?.type === 'tree') {
      items = Object
        .values(node.children)
        .sort((a, b) => b.type.localeCompare(a.type))
        .map(i => ({
          label: `$(${i.type === 'tree' ? 'json' : 'symbol-parameter'}) ${i.keypath}`,
          description: loader.getValueByKey(i.keypath),
          type: i.type,
          keypath: i.keypath,
        }))
    }
    else if (node?.type === 'node') {
      items = [
        {
          label: `$(symbol-parameter) ${node.keypath}`,
          description: loader.getValueByKey(node.keypath),
          type: node.type,
          keypath: node.keypath,
        },
      ]
    }

    if (existingItems.length)
      items = [...existingItems, ...items]

    // create new item if value not exists
    if (!isInsert && input && !input.endsWith('.') && !items.find(i => i.keypath === input)) {
      items.unshift({
        label: `$(add) ${input}`,
        description: i18n.t('prompt.create_new_path'),
        alwaysShow: true,
        keypath: input,
        type: 'new',
      })
    }

    return items
  }

  const extract = async(keypath: string, checkOverride = true) => {
    if (!keypath) {
      window.showWarningMessage(i18n.t('prompt.extraction_canceled'))
      return
    }
    if (!keypathValidate(keypath))
      return window.showWarningMessage(i18n.t('prompt.invalid_keypath'))

    const writeKeypath = CurrentFile.loader.rewriteKeys(keypath, 'write', { locale })

    let shouldOverride = 'skip'
    if (checkOverride) {
      shouldOverride = await overrideConfirm(writeKeypath, true, true)
      if (shouldOverride === 'retry') {
        commands.executeCommand(Commands.extract_text, options, detection)
        return
      }
      if (shouldOverride === 'canceled')
        return
    }

    const replacer = await promptTemplates(keypath, args, document, detection)

    if (!replacer) {
      window.showWarningMessage(i18n.t('prompt.extraction_canceled'))
      return
    }

    await extractHardStrings(document, [{
      range,
      replaceTo: replacer,
      keypath: shouldOverride === 'skip' ? undefined : writeKeypath,
      message: text,
      locale,
    }])
  }

  // create and init a QuickPick for the path
  const picker = window.createQuickPick<QuickPickItemWithKey>()
  picker.placeholder = i18n.t('prompt.enter_key_path', text)
  picker.ignoreFocusOut = true
  picker.canSelectMany = false
  picker.value = default_keypath
  picker.items = getPickItems(default_keypath)
  picker.matchOnDescription = true

  picker.onDidAccept(() => {
    const selection = picker.activeItems[0]
    if (!selection)
      return

    if (selection.type === 'new' || selection.type === 'node') {
      picker.dispose()
      extract(selection.keypath, !isInsert)
    }
    if (selection.type === 'existed') {
      picker.dispose()
      extract(selection.keypath, false)
    }
    else {
      const value = `${selection.keypath}.`
      picker.value = value
      picker.items = getPickItems(value)
      picker.show()
    }
  })

  picker.onDidChangeValue(() => {
    picker.items = getPickItems(picker.value)
    picker.show()
  })

  picker.onDidHide(() => picker.dispose())

  await picker.show()
}

function ExtractIngore(text: string, document?: TextDocument) {
  if (document) {
    const path = relative(Config.root, document.uri.fsPath)
    const obj = Config.extractIgnoredByFiles
    if (!obj[path])
      obj[path] = []
    obj[path].push(text)
    Config.extractIgnoredByFiles = obj
  }
  else {
    Config.extractIgnored = [...Config.extractIgnored, text]
  }

  CurrentFile.detectHardStrings(true)
}

const m: ExtensionModule = () => {
  return [
    commands.registerCommand(Commands.extract_text, ExtractOrInsertCommnad),
    commands.registerCommand(Commands.extract_ignore, ExtractIngore),
    commands.registerCommand(Commands.extract_enable_auto_detect, () => {
      Config.extractAutoDetect = true
    }),
    commands.registerCommand(Commands.extract_disable_auto_detect, () => {
      Config.extractAutoDetect = false
    }),
  ]
}

export default m
