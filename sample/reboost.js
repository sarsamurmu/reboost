const { start, plugins } = require('reboost');

start({
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
      loaders: ['jsx', 'tsx', 'ts']
    }),
    plugins.replace({
      ADJECTIVE: JSON.stringify('cool')
    })
  ],

  // Don't use these options, these are only for debugging
  // dumpCache: true,
  // debugMode: true,
});
