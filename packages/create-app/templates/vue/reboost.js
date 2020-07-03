const { start, DefaultConfig } = require('reboost');
const VuePlugin = require('@reboost/plugin-vue');

start({
  entries: [
    ['./src/index.js', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  resolve: {
    extensions: ['.vue'].concat(DefaultConfig.resolve.extensions)
  },
  plugins: [
    VuePlugin()
  ]
});
