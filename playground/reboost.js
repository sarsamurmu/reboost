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

start({
  entries: [
    ['./src/basic/index.js', './public/dist/basic.js', 'coolLib'],
    ['./src/svelte/index.js', './public/dist/svelte.js'],
    ['./src/babel/index.js', './public/dist/babel.js']
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
