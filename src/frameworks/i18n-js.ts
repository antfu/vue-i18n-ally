import { Framework } from './base'
import { LanguageId } from '~/utils'

class I18js extends Framework {
  id ='i18n-js'
  display = 'i18n.js'
  namespaceDelimiter = '.'

  detection = {
    packageJSON: {
      any: [
        'i18n-js',
      ],
    },
  }

  languageIds: LanguageId[] = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
    'ejs',
  ]

  // for visualize the regex, you can use https://regexper.com/
  usageMatchRegex = [
    '(?:i18n|I18n)\.t\(\s*[\'"`]({key})[\'"`]',
  ]

  refactorTemplates(keypath: string) {
    return [
      keypath,
    ]
  }
}

export default I18js
