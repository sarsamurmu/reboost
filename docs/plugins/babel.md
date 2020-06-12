# Babel Plugin
Adds support for transforming JavaScript or TypeScript with Babel.

## Usage
### Setup
Import `BabelPlugin` from Reboost
```js
const { start, BabelPlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, BabelPlugin } = require('reboost');

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
files. You can simply exclude them by using [`UsePlugin`](./use.md).
This will increase performance too.

```js
const { start, BabelPlugin, UsePlugin } = require('reboost');

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
const { start, BabelPlugin, UsePlugin } = require('reboost');

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
