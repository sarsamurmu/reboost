const {
  start,
  builtInPlugins: {
    FilePlugin,
    ReplacePlugin,
    UsePlugin
  }
} = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');
const SassPlugin = require('@reboost/plugin-sass');
const SveltePlugin = require('@reboost/plugin-svelte');
const VuePlugin = require('@reboost/plugin-vue');

start({
  entries: [
    ['./src/basic/index.js', './public/dist/basic.js', 'coolLib'],
    ['./src/react/index.js', './public/dist/react.js'],
    ['./src/svelte/index.js', './public/dist/svelte.js'],
    ['./src/babel/index.js', './public/dist/babel.js'],
    ['./src/vue/index.js', './public/dist/vue.js']
  ],
  contentServer: {
    root: './public'
  },
  plugins: [
    UsePlugin({
      include: /.png$/,
      use: FilePlugin()
    }),
    SassPlugin({
      sassOptions: {
        indentWidth: 4
      }
    }),
    ReplacePlugin({
      ADJECTIVE: JSON.stringify('cool')
    }),
    SveltePlugin(),
    VuePlugin(),
    UsePlugin({
      include: '**/src/babel/**',
      use: BabelPlugin({
        plugins: [
          ['@babel/plugin-proposal-pipeline-operator', { proposal: 'smart' }]
        ]
      })
    })
  ],
  showResponseTime: true,

  // Don't use these options, these are only for debugging
  dumpCache: true,
  // debugMode: true,
});
