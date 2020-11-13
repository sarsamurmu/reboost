[![npm](https://img.shields.io/npm/v/@reboost/plugin-postcss?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-postcss)
[![license](https://img.shields.io/npm/l/@reboost/plugin-postcss?style=flat-square)](/LICENSE)

# PostCSS Plugin
Adds support for transforming stylesheets with PostCSS. This plugin does not work with
PostCSS versions below 8, if you want to use PostCSS 7, please use the older version
of this plugin.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-postcss
```
Install `postcss` package, if not already installed.
```shell
npm i postcss
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

## Config file
This plugin uses [`postcss-load-config`](https://github.com/postcss/postcss-load-config) to load PostCSS
configurations. Please read their [readme](https://github.com/postcss/postcss-load-config/blob/master/README.md)
to understand how configuration files are loaded.

## Options
#### `ctx`
Type: `object`

This plugin exposes context `ctx` to the config file, so that your config file can be dynamic.
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

The path to search for any of the configuration files. Configurations can be loaded from
- [`package.json`](https://github.com/postcss/postcss-load-config/blob/master/README.md#packagejson)
- [`.postcssrc`](https://github.com/postcss/postcss-load-config/blob/master/README.md#postcssrc)
- [`.postcssrc.js` or `postcss.config.js`](https://github.com/postcss/postcss-load-config/blob/master/README.md#postcssrcjs-or-postcssconfigjs)

Using this option you can specify
another directory that should be searched for the config file, like when you store
your config files in different directories.
**The value should be a path to a DIRECTORY (where the config file is stored), not a path to a FILE**.
