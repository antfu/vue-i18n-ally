/* eslint-disable no-console */
import { dirname, join, basename, resolve } from 'path'
import { runTests } from '@vscode/test-electron'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { red, green, yellow, gray, cyan } from 'chalk'
// eslint-disable-next-line import/named
import { ArrayChange, diffArrays } from 'diff'

const args = process.argv.slice(2)

function deepDirname(dir: string, depth = 1) {
  for (let i = 0; i < depth; i++)
    dir = dirname(dir)
  return dir
}

export interface FixtureInfo {
  dirInput: string
  dirOutput: string
  dirConfig: string
  name: string
  category: string
  framework: string
}

export async function listAll(): Promise<FixtureInfo[]> {
  const root = 'test/fixtures/'
  const inputs = await fg(`${root}**/input`, {
    onlyDirectories: true,
  })

  return inputs.map(input => ({
    dirInput: input,
    dirOutput: join(dirname(input), 'output'),
    dirConfig: join(root, basename(deepDirname(input, 3)), '.vscode'),
    name: basename(dirname(input)),
    category: basename(deepDirname(input, 2)),
    framework: basename(deepDirname(input, 3)),
  }))
}

export async function prepareFixture(info: FixtureInfo) {
  const root = 'test/fixtures-temp'
  await fs.ensureDir(root)
  const id = info.framework
  const path = join(root, id)
  if (fs.existsSync(path))
    await fs.remove(path)

  await fs.ensureDir(info.dirConfig)
  await fs.copy(info.dirInput, path, { recursive: true })
  await fs.copy(info.dirConfig, join(path, '.vscode'), { recursive: true })

  return path
}

async function run() {
  let fixtures = await listAll()

  if (args[0])
    fixtures = fixtures.filter(i => i.dirInput.includes(args[0]))

  let failed = false
  for (const fixture of fixtures) {
    if (!await testFixture(fixture))
      failed = true
  }
  if (failed)
    process.exit(1)
}

let vscodeExecutablePath: string

async function testFixture(fixture: FixtureInfo) {
  const root = resolve(__dirname, '../..')
  const path = await prepareFixture(fixture)

  try {
    await runTests({
      extensionDevelopmentPath: root,
      extensionTestsPath: join(__dirname, 'runner.js'),
      vscodeExecutablePath,
      launchArgs: [path, '--disable-extensions'],
    })
  }
  catch (e) {
    console.log(yellow`❌ ${fixture.category} > ${fixture.name}`)
    console.error(e)
    return false
  }
  const result = await compareOut(fixture.dirOutput, path)
  let passed = true

  result.forEach((r) => {
    if (r.result == null) {
      console.log(yellow`${r.name}: file missing`)
      passed = false
    }
    else if (r.result.some(i => i.added || i.removed)) {
      console.log(cyan`${r.name}:`)
      printDiff(r.result)
      passed = false
    }
  })

  if (passed)
    console.log(green`✅ ${fixture.category} > ${fixture.name}`)
  else
    console.log(red`❌ ${fixture.category} > ${fixture.name}`)
  return passed
}

async function compareOut(target: string, out: string) {
  const files = await fg('**/*.*', { onlyFiles: true, cwd: target })
  return await Promise.all(files.map(async(file) => {
    const path = join(out, file)
    if (!fs.existsSync(path))
      return { name: file, result: null }

    const a = await fs.readFile(join(target, file), 'utf-8')
    const b = await fs.readFile(join(out, file), 'utf-8')
    return { name: file, result: diffArrays(a.trim().split('\n'), b.trim().split('\n')) }
  }))
}

function printDiff(diff: ArrayChange<string>[]) {
  let line = 0

  diff.forEach((part) => {
    const color = part.added
      ? red
      : part.removed
        ? green
        : gray

    for (const text of part.value) {
      line += 1
      const no = part.added
        ? '+'
        : part.removed
          ? '-'
          : line.toString()
      const message = part.removed && !text ? '(empty)' : text
      process.stderr.write(color`${no.padStart(3, ' ')} ${message}\n`)
    }
    if (part.removed)
      line -= part.value.length
  })

  process.stderr.write('\n')
}

run()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
