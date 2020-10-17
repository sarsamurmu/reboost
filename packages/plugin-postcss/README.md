[![npm](https://img.shields.io/npm/v/@reboost/plugin-postcss?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-postcss)
[![license](https://img.shields.io/npm/l/@reboost/plugin-postcss?style=flat-square)](/LICENSE)

# PostCSS Plugin
Adds support for transforming stylesheets with PostCSS.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-postcss
```
Install `postcss` package, if not already installed, for compatibility reasons this plugin
only works with PostCSS 7
```shell
npm i postcss@7.0.34
```
Import it from the package
```js
const { start } = require('reboost');
const PostCSSPlugin = require('@reboost/plugin-postcss');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const PostCSSPlugin = require('@reboost/plugin-postcss');

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
const { start } = require('reboost');
const PostCSSPlugin = require('@reboost/plugin-postcss');

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

#### `path`
Type: `string`

The path to search for `postcss.config.js` file. Using this option you can specify
another directory that should be searched for the config file, like when you store
your config files in different directories. Works same as [`postcss-loader`](https://www.npmjs.com/package/postcss-loader#path)'s
`path` option. The value should be a path to a directory, not a path to a file.
