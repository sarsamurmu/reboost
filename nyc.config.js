module.exports = {
  reporter: ['html', 'text-summary'],
  extension: ['.ts'],
  require: [
    'ts-node/register/transpile-only'
  ],
  sourceMap: true,
  instrument: true,
  'check-coverage': false,
  cache: true
}
