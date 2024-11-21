import SortedStringify from 'json-stable-stringify'
// @ts-ignorex
import JsonMap from 'json-source-map'
import { Parser } from './base'

export class ArbParser extends Parser {
  id = 'arb'

  constructor() {
    super(['arb'], 'arb')
  }

  async parse(text: string) {
    if (!text || !text.trim())
      return {}
    const json = JSON.parse(text)
    return proxyArb(json)
  }

  async dump(object: object, sort: boolean, compare: ((x: string, y: string) => number) | undefined) {
    const indent = this.options.tab === '\t' ? this.options.tab : this.options.indent

    if (sort)
      return `${SortedStringify(unproxyArb(object), { space: indent, cmp: wrapCompare(compare ?? ((a, b) => a.localeCompare(b))) })}\n`
    else
      return `${JSON.stringify(unproxyArb(object), null, indent)}\n`
  }

  annotationSupported = true
  annotationLanguageIds = ['arb']

  parseAST(text: string) {
    if (!text || !text.trim())
      return []

    const map = JsonMap.parse(text).pointers
    const pairs = Object.entries<any>(map)
      .filter(([k, v]) => k)
      .map(([k, v]) => ({
        quoted: true,
        start: v.value.pos + 1,
        end: v.valueEnd.pos - 1,
        // https://tools.ietf.org/html/rfc6901
        key: k.slice(1)
          .replace(/\//g, '.')
          .replace(/~0/g, '~')
          .replace(/~1/g, '/'),
      }))

    return pairs
  }
}

function proxyArb(arb: any) {
  return new Proxy(arb, {
    has(target, p) {
      if (typeof p === 'string' && p.startsWith('@'))
        return false
      return Reflect.has(target, p)
    },
    ownKeys(target) {
      return Object.keys(target).filter(it => !it.startsWith('@'))
    },
    get(target, p, receiver) {
      if (p === '__raw__')
        return target

      return target[p]
    },
  })
}

function unproxyArb(arb: any) {
  return arb.__raw__ ?? arb
}

function wrapCompare(compare: (x: string, y: string) => number): SortedStringify.Comparator {
  return ({ key: x }, { key: y }): number => {
    const xIsMeta = x.startsWith('@')
    const yIsMeta = y.startsWith('@')
    if (xIsMeta && !yIsMeta) {
      const r = compare(x.substring(1), y)
      return r === 0 ? 1 : r
    }
    if (!xIsMeta && yIsMeta) {
      const r = compare(x, y.substring(1))
      return r === 0 ? -1 : r
    }
    return compare(x, y)
  }
}
