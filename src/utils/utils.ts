import { KeyStyle } from '../core/types'
import { ROOT_KEY } from './flat'
import { Node, LocaleTree, LocaleNode, LocaleRecord, Config } from '~/core'

export function caseInsensitiveMatch(a: string, b: string) {
  return a.toUpperCase() === b.toUpperCase()
}

export function getKeyname(keypath: string) {
  const keys = keypath.split(/\./g)
  if (!keys.length)
    return ''
  return keys[keys.length - 1]
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function escapeMarkdown(text: string) {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function resolveFlattenRootKeypath(keypath: string) {
  if (keypath.endsWith(ROOT_KEY))
    keypath = keypath.slice(0, -ROOT_KEY.length)
  if (keypath.endsWith('.'))
    keypath = keypath.slice(0, -1)
  return keypath
}

export function resolveFlattenRoot (node: undefined): undefined
export function resolveFlattenRoot (node: LocaleRecord): LocaleRecord
export function resolveFlattenRoot (node: LocaleTree | LocaleNode): LocaleTree | LocaleNode
export function resolveFlattenRoot (node?: LocaleTree | LocaleNode): LocaleTree | LocaleNode | undefined
export function resolveFlattenRoot(node?: Node) {
  if (node?.type === 'tree' && node.getChild(ROOT_KEY)?.type === 'node')
    return node.getChild(ROOT_KEY)
  return node
}

export function set(obj: any, key: string, value: any, override = true) {
  if (Array.isArray(obj)) {
    const num = parseInt(key)
    if (!isNaN(num)) {
      if (override || obj[num] == null)
        obj[num] = value
      return obj[num]
    }
  }
  if (override || obj[key] == null)
    obj[key] = value
  return obj[key]
}

export function setNested(obj: any, keys: string[], value: any) {
  if (!keys.length)
    return
  const key = keys[0]
  if (keys.length === 1)
    set(obj, key, value)
  else
    setNested(set(obj, key, {}, false), keys.slice(1), value)
}

export function applyPendingToObject(obj: any, keypath: string, value: any, keyStyle?: KeyStyle) {
  if (!Config.disablePathParsing)
    keypath = resolveFlattenRootKeypath(keypath)

  if (keyStyle === 'flat')
    obj[keypath] = value
  else
    setNested(obj, keypath.split(/\./g), value)

  return obj
}

// abbreviateNumber source https://gist.github.com/tobyjsullivan/96d37ca0216adee20fa95fe1c3eb56ac

export function abbreviateNumber(value: number): string {
  let newValue = value
  const suffixes = ['', 'K', 'M', 'B', 'T']
  let suffixNum = 0
  while (newValue >= 1000) {
    newValue /= 1000
    suffixNum++
  }

  let result = newValue.toPrecision(3)

  result += suffixes[suffixNum]
  return result
}

/**
 * Get a locale aware comparison function
 */
export function getLocaleCompare(
  sortLocaleSetting: string | undefined,
  fileLocale: string
): (x: string, y: string) => number {
  const sortLocale = sortLocaleSetting ? sortLocaleSetting : fileLocale;
  return new Intl.Collator(sortLocale).compare;
}

export function preSufArgString(args: string[]){
  return `${Config.argsPrefix}${args.length - 1}${Config.argsSuffix}`
}