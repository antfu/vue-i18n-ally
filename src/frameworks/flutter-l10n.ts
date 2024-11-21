import path from 'path'
import fs from 'fs'
import YAML from 'js-yaml'
import { Framework } from './base'
import { File, LanguageId, Log } from '~/utils'
import { PubspecYAMLParser } from '~/packagesParsers'
import { DirStructure, KeyStyle } from '~/core'

class FlutterL10nFramework extends Framework {
  id= 'flutter-l10n'
  display= 'Flutter L10n'

  detection = {
    pubspecYAML: (_: string[], root: string) => {
      const filepath = path.resolve(root, PubspecYAMLParser.filename)
      if (!fs.existsSync(filepath))
        return false
      try {
        const yaml = YAML.load(File.readSync(filepath)) as any
        return !!(yaml?.flutter?.generate)
      }
      catch (e) {
        Log.error(e)
      }
      return false
    },
  }

  languageIds: LanguageId[] = [
    'dart',
  ]

  // for visualize the regex, you can use https://regexper.com/
  usageMatchRegex = [
    'S\\.of\\([\\w.]+\\)[?!]?\\.({key})\\W',
    'AppLocalizations\\.of\\([\\w.]+\\)[?!]?\\.({key})\\W',
  ]

  preferredKeystyle?: KeyStyle = 'flat'
  preferredDirStructure?: DirStructure = 'file'
  preferredLocalePaths?: string[] = ['lib/l10n']

  refactorTemplates(keypath: string) {
    return [
      `S.of(context).${keypath}`,
      `AppLocalizations.of(context).${keypath}`,
      keypath,
    ]
  }
}

export default FlutterL10nFramework
