# PostCSS Plugin
Adds support for transforming stylesheets with PostCSS.

## Usage
### Setup
Import `PostCSSPlugin`
```js
const {
  start,
  builtInPlugins: {
    PostCSSPlugin
  }
} = require('reboost');
```
Add it to the plugins array
```js
const {
  start,
  builtInPlugins: {
    PostCSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    PostCSSPlugin({
      // Options
    })
  ]
})
```
Now it will transform all stylesheets with your PostCSS plugins.

## Options
#### `ctx`
Type: `object`

Like webpack's [`postcss-loader`](https://www.npmjs.com/package/postcss-loader#context-ctx), this plugin
also exposes context `ctx` to the config file, so that your config file can be dynamic.
Like so

`postcss.config.js`
```js
module.exports = ({ file, options, env }) => {
  parser: file.extname === '.sss' ? 'sugarss' : undefined
  // More configurations
}
```

You can set `ctx` to an `object` to pass the data to the `options` object in
your `postcss.config.js`, like so

`reboost.js`
```js
const {
  start,
  builtInPlugins: {
    PostCSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    PostCSSPlugin({
      ctx: {
        usePreset: true
      }
    })
  ]
})
```
`postcss.config.js`
```js
module.exports = ({ file, options, env }) => {
  plugins: {
    // `usePreset` is now available in `options` object
    'postcss-preset-env': options.usePreset ? {} : false
  }
}
```
