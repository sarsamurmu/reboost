// @ts-check
const {
  start,
  builtInPlugins: {
    FilePlugin,
    ReplacePlugin,
    UsePlugin
  }
} = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');
const ReactFastRefreshPlugin = require('@reboost/plugin-react-refresh');
const SassPlugin = require('@reboost/plugin-sass');
const SveltePlugin = require('@reboost/plugin-svelte');
const VuePlugin = require('@reboost/plugin-vue');
const PostCSSPlugin = require('@reboost/plugin-postcss');
const MalinaJSPlugin = require('@reboost/plugin-malinajs');

console.time();
start({
  entries: [
    ['./src/babel/index.js', './public/dist/babel.js'],
    ['./src/basic/index.js', './public/dist/basic.js', 'coolLib'],
    ['./src/css-and-assets/index.js', './public/dist/css-and-assets.js'],
    ['./src/hot-reload-test/index.js', './public/dist/hot-reload-test.js'],
    ['./src/lit-element/index.js', './public/dist/lit-element.js'],
    ['./src/malina/index.js', './public/dist/malina.js'],
    ['./src/postcss/index.js', './public/dist/postcss.js'],
    ['./src/react/index.jsx', './public/dist/react.js'],
    ['./src/sass/index.js', './public/dist/sass.js'],
    ['./src/svelte/index.js', './public/dist/svelte.js'],
    ['./src/vue/index.js', './public/dist/vue.js']
  ],
  commonJSInterop: {
    mode: 2
  },
  contentServer: {
    root: './public',
    index: false,
    // basePath: '/custom-path',
  },
  hotReload: true,
  plugins: [
    UsePlugin({
      include: './**/*.lit.css',
      use: require('./lit-css-plugin')()
    }),
    UsePlugin({
      include: './src/postcss/**',
      use: PostCSSPlugin()
    }),
    UsePlugin({
      include: /\.(png|jpg)$/,
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
    MalinaJSPlugin(),
    SveltePlugin(),
    VuePlugin(),
    UsePlugin({
      include: './src/babel/**',
      use: BabelPlugin({
        plugins: [
          ['@babel/plugin-proposal-pipeline-operator', { proposal: 'smart' }]
        ]
      })
    }, {
      include: './src/react/**',
      use: ReactFastRefreshPlugin()
    })
  ],
  log: {
    info: true,
    responseTime: true,
    // watchList: true
  },

  // Don't use these options, these are only for debugging
  dumpCache: true,
  debugMode: true,
}).then(() => console.timeEnd());
