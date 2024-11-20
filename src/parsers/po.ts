/* eslint-disable import/order */
import PO from 'pofile'
import { KeyStyle } from '~/core'
import { File } from '~/utils'
import { Parser } from './base'

export class PoParser extends Parser {
  id = 'po'

  constructor() {
    super(['po'], 'po(?:t|tx)?')
  }

  async parse(text: string) {
    const items = PO.parse(text).items
    const result: Record<string, string> = {}
    for (const item of items) {
      if (item.msgstr.length)
        result[item.msgid] = item.msgstr.join()
    }
    return result
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async dump(object: object) {
    return ''
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override async save(filepath: string, object: Record<string, string>, sort: boolean, compare: ((x: string, y: string) => number) | undefined) {
    const raw = await File.read(filepath)
    const po_items = PO.parse(raw)

    const items = Object.keys(object).map((key) => {
      const current = po_items.items.find(x => x.msgid === key)
      const item = new PO.Item()
      item.msgid = key
      item.msgstr = [object[key].replace(/\n\n/g, '\n')]
      item.comments = current?.comments || []
      item.extractedComments = current?.extractedComments || []
      item.msgctxt = current?.msgctxt
      item.references = current?.references || []
      item.flags = current?.flags || {}
      return item
    })

    const po = new PO()
    po.items = items
    po.comments = po_items.comments
    po.extractedComments = po_items.extractedComments
    po.headers = po_items.headers

    await new Promise<void>((resolve, reject) => {
      po.save(filepath, (err) => {
        if (err)
          reject(err)
        else
          resolve()
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override navigateToKey(text: string, keypath: string, keystyle: KeyStyle) {
    const index = text.search(`"${keypath}"`)
    if (index === -1) return undefined

    const start = index + 1
    const end = start + keypath.length
    return { start, end, key: keypath, quoted: true }
  }
}
