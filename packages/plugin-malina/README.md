[![npm](https://img.shields.io/npm/v/@reboost/plugin-malina?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-malina)
[![license](https://img.shields.io/npm/l/@reboost/plugin-malina?style=flat-square)](/LICENSE)

# Malina Plugin
Adds support for Malina.js.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-malina
```
Install `malinajs` package, if not already installed
```shell
npm i malinajs
```
Import it from the package
```js
const { start } = require('reboost');
const MalinaPlugin = require('@reboost/plugin-malina');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const MalinaPlugin = require('@reboost/plugin-malina');

start({
  plugins: [
    MalinaPlugin({
      // Options
    })
  ]
})
```
### Require file in your code
```js
import Component from './file.ma';
```

# License
Licensed under the [MIT License](/LICENSE).
