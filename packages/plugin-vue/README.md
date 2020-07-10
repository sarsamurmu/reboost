[![npm](https://img.shields.io/npm/v/@reboost/plugin-vue?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-vue)
[![license](https://img.shields.io/npm/l/@reboost/plugin-vue?style=flat-square)](/LICENSE)

# Vue Plugin
Adds support for `.vue` files, using [Vue 3 SFC compiler](https://www.npmjs.com/package/@vue/compiler-sfc).

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-vue
```
Import it from the package
```js
const { start } = require('reboost');
const VuePlugin = require('@reboost/plugin-vue');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const VuePlugin = require('@reboost/plugin-vue');

start({
  plugins: [
    VuePlugin()
  ]
})
```
### Require file in your code
```js
import Component from './file.vue';
```

# License
Licensed under the [MIT License](/LICENSE).
