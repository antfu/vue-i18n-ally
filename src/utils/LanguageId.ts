
export const LanguageIdExtMap = {
  'javascript': 'js',
  'typescript': 'ts',
  'javascriptreact': 'jsx',
  'typescriptreact': 'tsx',
  'vue': 'vue',
  'vue-html': 'vue',
  'json': 'json',
  'html': 'html',
  'dart': 'dart',
  'php': 'php',
  'ejs': 'ejs',
  'ruby': 'rb',
  'erb': 'erb',
  'html.erb': 'erb',
  'js.erb': 'erb',
  'haml': 'haml',
  'slim': 'slim',
  'handlebars': 'hbs',
  'blade': 'php',
  'svelte': 'svelte',
  'xml': 'xml',
}

export type LanguageId = keyof typeof LanguageIdExtMap

export function getExtOfLanguageId(id: LanguageId) {
  return LanguageIdExtMap[id] || id
}
