const {
  start,
  builtInPlugins: {
    esbuildPlugin
  }
} = require('reboost');

start({
  entries: [
    ['./src/index.jsx', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  plugins: [
    esbuildPlugin({
      jsx: {
        fragment: 'Fragment',
        factory: 'h'
      }
    })
  ]
});
