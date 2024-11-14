import child_process from 'child_process'
import path from 'path'
import ts from 'typescript'
import { Parser } from './base'
import i18n from '~/i18n'
import { Log } from '~/utils'
import { Config, Global, KeyInDocument } from '~/core'

const LanguageIds = {
  js: 'javascript',
  ts: 'typescript',
} as const

const LanguageExts = {
  js: 'm?js',
  ts: 'ts',
} as const

export class EcmascriptParser extends Parser {
  readonly readonly = true

  constructor(public readonly id: 'js' | 'ts' = 'js') {
    super([LanguageIds[id]], LanguageExts[id])
  }

  async parse() {
    return {}
  }

  async dump() {
    return ''
  }

  async load(filepath: string) {
    const loader = path.resolve(Config.extensionPath!, 'assets/loader.js')
    const tsNode = Config.parsersTypescriptTsNodePath
    const dir = Global.rootpath
    const compilerOptions = {
      importHelpers: false,
      allowJs: true,
      module: 'commonjs',
      ...Config.parsersTypescriptCompilerOption,
    }
    const options = JSON.stringify(compilerOptions).replace(/"/g, '\\"')

    return new Promise<any>((resolve, reject) => {
      const cmd = `${tsNode} --dir "${dir}" --transpile-only --compiler-options "${options}" "${loader}" "${filepath}"`
      // eslint-disable-next-line no-console
      console.log(`[i18n-ally] spawn: ${cmd}`)
      child_process.exec(cmd, (err, stdout) => {
        if (err) return reject(err)
        try {
          resolve(JSON.parse(stdout.trim()))
        }
        catch (e) {
          reject(e)
        }
      })
    })
  }

  async save() {
    Log.error(i18n.t('prompt.writing_js'))
  }

  parseAST(text: string): KeyInDocument[] {
    const sourceFile = ts.createSourceFile(
      'ts-source',
      text,
      ts.ScriptTarget.Latest,
    )

    const traverseNode = (node: ts.Node, path: string[] = []) => {
      let res: KeyInDocument[] = []
      if (!node)
        return []

      if (
        ts.isPropertyAssignment(node)
        && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      ) {
        const start = node.getStart(sourceFile)
        const end = node.name.getEnd()

        path = [...path, node.name.text]
        res.push({
          key: path.join('.'),
          start,
          end,
          quoted: ts.isStringLiteral(node.name),
        })
      }

      ts.forEachChild(node, (node) => {
        const r = traverseNode(node, path)
        res = res.concat(r)
      })

      return res
    }

    return traverseNode(sourceFile)
  }
}
