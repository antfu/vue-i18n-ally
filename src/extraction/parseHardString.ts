/**
 * 'foo' + bar() + ' is cool' -> `foo${bar()} is cool`
 */
export function stringConcatenationToTemplate(text: string) {
  text = text.trim()
  if (!text.match(/^['"`]/))
    text = `''+${text}`
  if (!text.match(/['"`]$/))
    text = `${text}+''`

  // replace quotes with `\0`
  text = text
    .replace(/([^\\])(['"`])/g, '$1\u0000')
    .replace(/([^\\])(['"`])/g, '$1\u0000')
    .replace(/^(['"`])/g, '\u0000')

  // concatenation
  text = text.replace(/\0\s*\+\s*(.*?)\s*\+\s*\0/g, (full, one) => `$\{${one.trim()}}`)

  // revert back quotes
  text = text.replace(/\0/g, '`')
  return text
}

export function parseHardString(text = '', languageId?: string, isDynamic = false, argsToStringCallback = (args:string[])=>`{${args.length - 1}}`) {
  const trimmed = text.trim().replace(/\s*\r?\n\s*/g, ' ')
  let processed = trimmed
  const args: string[] = []
  if (!trimmed)
    return null

  if (isDynamic && ['vue', 'js'].includes(languageId || ''))
    processed = stringConcatenationToTemplate(processed).slice(1, -1)

  processed = processed.replace(/(?:\{\{(.*?)\}\}|\$\{(.*?)\})/g, (full, content, content2) => {
    args.push((content ?? content2 ?? '').trim())
    return argsToStringCallback(args)
  })

  return {
    trimmed,
    text: processed,
    args,
  }
}
