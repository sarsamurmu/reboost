const { plugins } = require('reboost');

module.exports = {
  entries: [
    ['./src/index.js', './public/dist/main.js', 'coolLib']
  ],
  contentServer: {
    root: './public'
  },
  resolve: {
    extensions: ['.js', '.ts']
  },
  plugins: [
    plugins.esbuild({
      loaders: ['jsx', 'tsx', 'ts'],
      jsxFactory: 'h'
    })
  ],
  dumpCache: true,
  debugMode: true,
}
