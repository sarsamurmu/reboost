const {
  start,
  ReplacePlugin,
  FilePlugin,
  UsePlugin
} = require('reboost');

start({
  entries: [
    ['./src/index.js', './public/dist/main.js', 'coolLib']
  ],
  contentServer: {
    root: './public'
  },
  plugins: [
    UsePlugin({
      test: /.png$/,
      use: FilePlugin()
    }),
    ReplacePlugin({
      ADJECTIVE: JSON.stringify('cool')
    })
  ],

  // Don't use these options, these are only for debugging
  dumpCache: true,
  debugMode: true,
});
