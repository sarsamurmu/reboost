# Babel Plugin
Adds support for transforming JavaScript or TypeScript with Babel.

## Usage
### Setup
1. Install it using `npm`
```shell
npm i @reboost/plugin-babel -D
```
2. Install `@babel/core`, if not already installed
```shell
npm i @babel/core
```
1. Import it from the package
```js
const { start } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');
```
4. Add it to the plugins array
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
