const {
  start,
  builtInPlugins: {
    esbuildPlugin,
    UsePlugin
  }
} = require('reboost');
const PrefreshPlugin = require('@reboost/plugin-prefresh');

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
    }),
    UsePlugin({
      // The following glob enables fast refresh for files
      // with .js, .ts, .jsx or .tsx extensions which are inside "src" directory
      // Feel free to use any glob or regex for your files
      include: './src/**/*.{js,jsx,ts,tsx}',
      use: PrefreshPlugin()
    })
  ]
});
