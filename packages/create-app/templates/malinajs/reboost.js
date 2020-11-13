const { start, DefaultConfig } = require('reboost');
const MalinaJSPlugin = require('@reboost/plugin-malinajs');

start({
  entries: [
    ['./src/index.js', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  plugins: [
    MalinaJSPlugin()
  ]
});
