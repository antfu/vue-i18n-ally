module.exports = {
  env: {
    es6: true,
    browser: true,
    node: true,
    mocha: true,
  },
  extends: '@antfu',
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', {
      args: 'none',
      varsIgnorePattern: '^_',
    }],
  },
}
