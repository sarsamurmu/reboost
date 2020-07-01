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
