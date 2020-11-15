[![npm](https://img.shields.io/npm/v/@reboost/plugin-react-refresh?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-react-refresh)
[![license](https://img.shields.io/npm/l/@reboost/plugin-react-refresh?style=flat-square)](/LICENSE)

# React Refresh Plugin
Enables support for React Fast Refresh, so that you can develop your app *faster*.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-react-refresh
```
Import it from the package
```js
const { start } = require('reboost');
const ReactRefreshPlugin = require('@reboost/plugin-react-refresh');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const ReactRefreshPlugin = require('@reboost/plugin-react-refresh');

start({
  plugins: [
    ReactRefreshPlugin({
      // Options
    })
  ]
})
```

## Options
#### `excludeNodeModules`
Type: `boolean`\
Default: `true`

Excludes all files which match `/node_modules/`. Disabling it will decrease performance.

## Example
### Improving performance by excluding non-related files
By default, it runs the transformation on all files. You can run the transformation
only on the files which need it by using `UsePlugin`.
```js
const {
  start,
  builtInPlugins: {
    UsePlugin
  }
} = require('reboost');
const ReactRefreshPlugin = require('@reboost/plugin-react-refresh');

start({
  // Other options
  plugins: [
    // Other plugins
    UsePlugin({
      include: /\.[jt]sx?$/, // Selects only the files with .js, .ts, .jsx or .tsx extension
      use: ReactRefreshPlugin()
    })
  ]
  // ...
})
```

# License
Licensed under the [MIT License](/LICENSE).
