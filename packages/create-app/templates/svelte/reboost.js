const { start, DefaultConfig } = require('reboost');
const SveltePlugin = require('@reboost/plugin-svelte');

start({
  entries: [
    ['./src/index.js', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  resolve: {
    extensions: ['.svelte'].concat(DefaultConfig.resolve.extensions),
    mainFields: ['svelte'].concat(DefaultConfig.resolve.mainFields)
  },
  plugins: [
    SveltePlugin()
  ]
});
