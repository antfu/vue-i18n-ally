import path, { normalize } from 'path'
import iconv from 'iconv-lite'
import fs from 'fs-extra'
import { Config } from '~/core'

interface FileEncoding {
  encoding: string
  bom: boolean
}

interface DecodeData {
  encoding: string
  bom: boolean
  content: string
}

const defaultEncoding = 'utf-8'
const encodingMapping: Record<string, string> = {
  'ascii': defaultEncoding,
  'windows-1252': defaultEncoding,
}

export class File {
  private static _fileEncoding: Record<string, FileEncoding> = {}

  private static __setFileEncoding(filepath: string, encoding: FileEncoding) {
    filepath = normalize(filepath)
    this._fileEncoding[filepath] = encoding
  }

  private static __getFileEncoding(filepath: string): FileEncoding {
    filepath = normalize(filepath)
    const info: FileEncoding = this._fileEncoding[filepath] || {
      encoding: '',
      bom: false,
    }

    if (!info.encoding && Config.encoding !== 'auto')
      info.encoding = Config.encoding

    if (!info.encoding)
      info.encoding = defaultEncoding

    return info
  }

  static async read(filepath: string, encodingConfig: string = Config.encoding): Promise<string> {
    const raw = await fs.readFile(filepath)
    const { encoding, bom, content } = File.decode(raw, encodingConfig)
    // console.log('READ', filepath, encoding, bom)
    this.__setFileEncoding(filepath, { encoding, bom })
    return content
  }

  static readSync(filepath: string, encodingConfig: string = Config.encoding): string {
    const raw = fs.readFileSync(filepath)
    const { encoding, bom, content } = File.decode(raw, encodingConfig)
    this.__setFileEncoding(filepath, { encoding, bom })
    return content
  }

  static async write(filepath: string, data: any, opts?: FileEncoding) {
    const { encoding, bom } = opts || this.__getFileEncoding(filepath)
    await fs.ensureDir(path.dirname(filepath))
    const buffer = Buffer.from(File.encode(data, encoding, bom))
    await fs.writeFile(filepath, buffer)
  }

  static writeSync(filepath: string, data: any, opts?: FileEncoding) {
    const { encoding, bom } = opts || this.__getFileEncoding(filepath)
    fs.ensureDirSync(path.dirname(filepath))
    const buffer = Buffer.from(File.encode(data, encoding, bom))
    fs.writeFileSync(filepath, buffer)
  }

  static decode(buffer: Buffer, encoding?: string): DecodeData {
    if (!encoding)
      encoding = defaultEncoding

    if (encodingMapping[encoding])
      encoding = encodingMapping[encoding]

    const content = iconv.decode(buffer, encoding)
    let bom = false

    // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
    // conversion translates it to FEFF (UTF-16 BOM)
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF)
      bom = true

    return {
      encoding,
      content,
      bom,
    }
  }

  static encode(string: string, encoding: string, addBOM = true): Buffer {
    return iconv.encode(string, encoding, { addBOM })
  }
}
