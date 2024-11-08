export function keypathValidate(keypath: string) {
  return !!keypath.match(/^[\u4e00-\u9fa5\w\d\-_][\u4e00-\u9fa5\w\d\-_[\]. ]*$/)
}
