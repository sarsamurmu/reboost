// @ts-check
const {
  start,
  builtInPlugins: {
    esbuildPlugin,
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
const LitCSSPlugin = require('@reboost/plugin-litcss');
const TypeScriptPlugin = require('@reboost/plugin-typescript');
const PrefreshPlugin = require('@reboost/plugin-prefresh');

const startTime = process.hrtime();
start({
  entries: [
    ['./src/babel/index.js', './public/dist/babel.js'],
    ['./src/basic/index.js', './public/dist/basic.js', 'coolLib'],
    ['./src/css-and-assets/index.js', './public/dist/css-and-assets.js'],
    ['./src/hot-reload-test/index.js', './public/dist/hot-reload-test.js'],
    ['./src/lit/index.js', './public/dist/lit.js'],
    ['./src/malina/index.js', './public/dist/malina.js'],
    ['./src/postcss/index.js', './public/dist/postcss.js'],
    ['./src/preact/index.jsx', './public/dist/preact.js'],
    ['./src/react/index.jsx', './public/dist/react.js'],
    ['./src/sass/index.js', './public/dist/sass.js'],
    ['./src/svelte/index.js', './public/dist/svelte.js'],
    ['./src/typescript/index.ts', './public/dist/typescript.js'],
    ['./src/vue/index.js', './public/dist/vue.js']
  ],
  commonJSInterop: {
    mode: 2
  },
  contentServer: [
    {
      name: 'main',
      root: './public',
      index: false,
      // basePath: '/custom-path',
    },
    {
      name: 'index',
      root: './public',
      index: 'index.html'
    },
    {
      root: './public',
      index: './index2.html'
    }
  ],
  hotReload: true,
  plugins: [
    UsePlugin({
      include: './**/*.lit.css',
      use: LitCSSPlugin()
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
    }),
    UsePlugin({
      include: './src/preact/**',
      use: [
        esbuildPlugin({
          jsx: {
            factory: 'h',
            fragment: 'Fragment'
          }
        }),
        PrefreshPlugin()
      ]
    }),
    UsePlugin({
      include: './src/typescript/**',
      use: TypeScriptPlugin({
        tsconfig: './src/typescript/tsconfig.json'
      })
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
}).then(() => {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  console.log(`Took - ${seconds}s ${Math.floor(nanoseconds / 1e6)}ms`)
});
