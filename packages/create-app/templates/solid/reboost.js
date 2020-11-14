const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');

start({
  entries: [
    ['./src/index.jsx', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  plugins: [
    UsePlugin({
      include: /.*/,
      exclude: /node_modules/,
      use: BabelPlugin({
        presets: [require('babel-preset-solid')]
      })
    })
  ]
});
