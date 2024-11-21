import path from 'path'
import { RewriteKeySource, DataProcessContext, RewriteKeyContext } from '../core/types'
import { Framework } from './base'
import { LanguageId } from '~/utils'
import { Config, Global } from '~/core'

class RubyRailsFramework extends Framework {
  id= 'ruby-rails'
  display= 'Ruby on Rails'

  detection = {
    gemfile: [
      'rails',
      'rails-i18n',
    ],
  }

  languageIds: LanguageId[] = [
    'ruby',
    'haml',
    'slim',
    'html.erb',
    'js.erb',
    'erb',
  ]

  usageMatchRegex = [
    '[^\\w\\d]t(?:\\(| )[\'"`]({key})[\'"`]',
    // #583
    '[^\\w\\d]t\\(\\:({key})\\)',
  ]

  refactorTemplates(keypath: string) {
    return [
      `t(".${keypath}")`,
      keypath,
    ]
  }

  preprocessData(data: any, context: DataProcessContext): object {
    return data[context.locale || ''] || {}
  }

  deprocessData(data: any, context: DataProcessContext): object {
    return {
      [context.locale || '']: data,
    }
  }

  rewriteKeys(key: string, source: RewriteKeySource, context: RewriteKeyContext = {}) {
    if (source === 'reference' && key.startsWith('.') && context.targetFile) {
      const root = path.resolve(Global.rootpath, Config.frameworksRubyRailsScopeRoot)
      let scope = path.relative(root, context.targetFile)

      scope = scope
        // remove file extensions
        .replace(/(?:\.html(\+.*|)\.erb|\.html\.haml|\.html\.slim|\.haml)$/, '')
        // map path delimiter to dots
        .replace(/(?:\/|\\)/g, '.')
        // omit the starting underscore on each file
        .replace(/\._/g, '.')
        // remove the very starting underscore
        .replace(/^_/g, '')

      return scope + key
    }
    return key
  }
}

export default RubyRailsFramework
