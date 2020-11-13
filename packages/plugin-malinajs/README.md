[![npm](https://img.shields.io/npm/v/@reboost/plugin-malinajs?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-malinajs)
[![license](https://img.shields.io/npm/l/@reboost/plugin-malinajs?style=flat-square)](/LICENSE)

# Malina.js Plugin
Adds support for Malina.js.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-malinajs
```
Install `malinajs` package, if not already installed
```shell
npm i malinajs
```
Import it from the package
```js
const { start } = require('reboost');
const MalinaJSPlugin = require('@reboost/plugin-malinajs');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const MalinaJSPlugin = require('@reboost/plugin-malinajs');

start({
  plugins: [
    MalinaJSPlugin({
      // Options
    })
  ]
})
```
### Require file in your code
```js
import Component from './file.xht';
```

# License
Licensed under the [MIT License](/LICENSE).
