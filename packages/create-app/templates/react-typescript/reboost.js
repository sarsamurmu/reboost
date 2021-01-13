const {
  start,
  builtInPlugins: {
    UsePlugin
  }
} = require('reboost');
const ReactRefreshPlugin = require('@reboost/plugin-react-refresh');

start({
  entries: [
    ['./src/index.tsx', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  plugins: [
    UsePlugin({
      // The following regex enables fast refresh for files
      // with .js, .ts, .jsx or .tsx extensions
      // Feel free to use any regex for your files
      include: /\.[jt]sx?$/i,
      use: ReactRefreshPlugin()
    })
  ]
});
