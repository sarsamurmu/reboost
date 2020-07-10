[![npm](https://img.shields.io/npm/v/@reboost/plugin-babel?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-babel)
[![license](https://img.shields.io/npm/l/@reboost/plugin-babel?style=flat-square)](/LICENSE)

# Babel Plugin
Adds support for transforming JavaScript or TypeScript with Babel.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-babel
```
Install `@babel/core`, if not already installed
```shell
npm i @babel/core
```
Import it from the package
```js
const { start } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');

start({
  plugins: [
    BabelPlugin({
      // Options
    })
  ]
})
```

## Options
Supports all [Babel options](https://babeljs.io/docs/en/options).

## Example
### Speeding up the build by excluding node modules
You may not need babel transformations on `node_modules`
files. You can simply exclude them by using [`UsePlugin`](https://github.com/sarsamurmu/reboost/blob/primary/docs/built-in-plugins/use.md).
This will increase performance too.

```js
const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');

start({
  plugins: [
    UsePlugin({
      include: /.*/,
      exclude: /node_modules/,
      use: BabelPlugin()
    })
  ]
})
```

### Transforming new features
**NOTE:** While developing (not production) your app you should not transform
your JavaScript code to support extremely old browsers,
you should transform just the new features or proposals.

```js
const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');

start({
  plugins: [
    UsePlugin({
      include: /.*/,
      exclude: /node_modules/,
      use: BabelPlugin({
        plugins: [
          // Your babel plugin,
          // for example
          ['@babel/plugin-proposal-pipeline-operator', { proposal: 'smart' }]
        ]
      })
    })
  ]
})
```

# License
Licensed under the [MIT License](/LICENSE).
