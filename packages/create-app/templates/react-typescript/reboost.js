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
      // The following glob enables fast refresh for files
      // with .js, .ts, .jsx or .tsx extensions which are inside "src" directory
      // Feel free to use any glob or regex for your files
      include: './src/**/*.{js,jsx,ts,tsx}',
      use: ReactRefreshPlugin()
    })
  ]
});
