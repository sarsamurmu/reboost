const { start, ReplacePlugin } = require('reboost');

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
    ReplacePlugin({
      ADJECTIVE: JSON.stringify('cool')
    })
  ],

  // Don't use these options, these are only for debugging
  dumpCache: true,
  debugMode: true,
});
