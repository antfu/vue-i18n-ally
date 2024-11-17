import { sortBy } from 'lodash'
import { QUOTE_SYMBOLS } from '../meta'
import { KeyInDocument, RewriteKeyContext } from '../core/types'
import { ScopeRange } from '../frameworks/base'
import { Log } from '.'
import i18n from '~/i18n'
import { CurrentFile, Config } from '~/core'

export function handleRegexMatch(
  text: string,
  match: RegExpExecArray,
  dotEnding = false,
  rewriteContext?: RewriteKeyContext,
  scopes: ScopeRange[] = [],
  defaultNamespace?: string,
  starts: number[] = [],
): KeyInDocument | undefined {
  const matchString = match[0]
  let key = match[1]
  const scope = scopes?.[0]
  const nsIndex = match[2] ? parseInt(match[2], 10) : 0
  if (!key) return

  const start = match.index + matchString.lastIndexOf(key)
  const end = start + key.length
  const quoted = QUOTE_SYMBOLS.includes(text[start - 1])

  if (starts.includes(start)) return
  starts.push(start)

  const namespaces = scope?.namespaces || [defaultNamespace]
  const namespace = namespaces[nsIndex] || namespaces[0] || defaultNamespace

  if (namespace !== defaultNamespace) {
    // 檢查 key 是否存在於指定的 namespace
    const namespaceKey = `${namespace}.${key}`

    key = CurrentFile.loader.exists(namespaceKey)
      ? namespaceKey
      : `${defaultNamespace}.${key}`
  }
  else {
    key = `${namespace}.${key}`
  }

  if (dotEnding || !key.endsWith('.')) {
    key = CurrentFile.loader.rewriteKeys(key, 'reference', {
      ...rewriteContext,
      namespace,
    })
    return {
      key,
      start,
      end,
      quoted,
    }
  }
}

// export function regexFindKeys(
//   text: string,
//   regs: RegExp[],
//   dotEnding = false,
//   rewriteContext?: RewriteKeyContext,
//   scopes: ScopeRange[] = [],
// ): KeyInDocument[] {
//   if (Config.disablePathParsing)
//     dotEnding = true

//   const defaultNamespace = Config.defaultNamespace
//   const keys: KeyInDocument[] = []
//   const starts: number[] = []

//   for (const reg of regs) {
//     let match = null
//     reg.lastIndex = 0
//     // eslint-disable-next-line no-cond-assign
//     while (match = reg.exec(text)) {
//       const key = handleRegexMatch(text, match, dotEnding, rewriteContext, scopes, defaultNamespace, starts)
//       if (key)
//         keys.push(key)
//     }
//   }

//   return sortBy(keys, i => i.start)
// }
export function regexFindKeys(
  text: string,
  regs: RegExp[],
  dotEnding = false,
  rewriteContext?: RewriteKeyContext,
  scopes: ScopeRange[] = [],
): KeyInDocument[] {
  if (Config.disablePathParsing)
    dotEnding = true

  const defaultNamespace = Config.defaultNamespace
  const keys: KeyInDocument[] = []
  const starts: number[] = []

  for (const reg of regs) {
    let match = null
    reg.lastIndex = 0

    // eslint-disable-next-line no-cond-assign
    while (match = reg.exec(text)) {
      const key = handleRegexMatch(text, match, dotEnding, rewriteContext, scopes, defaultNamespace, starts)
      if (key)
        keys.push(key)
    }
  }

  return sortBy(keys, i => i.start)
}

export function normalizeUsageMatchRegex(reg: (string | RegExp)[]): RegExp[] {
  return reg.map((i) => {
    if (typeof i === 'string') {
      try {
        const interpated = i.replace(/{key}/g, Config.regexKey)
        return new RegExp(interpated, 'gm')
      }
      catch (e) {
        Log.error(i18n.t('prompt.error_on_parse_custom_regex', i), true)
        Log.error(e, false)
        return undefined
      }
    }
    return i
  })
    .filter(i => i) as RegExp[]
}
