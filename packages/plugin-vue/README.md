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

## Options
#### `compiler`
Type: `object`

Compiler to use when compiling SFCs. You may need it if you want to use a different version
of the SFC compiler than the one which comes with this package. First, install the version of the compiler
you want to use then pass it to the options. Like so
```js
const { start } = require('reboost');
const VuePlugin = require('@reboost/plugin-vue');

start({
  plugins: [
    VuePlugin({
      // Install the version of the compiler you want
      // then pass it to the plugin
      compiler: require('@vue/compiler-sfc')
    })
  ]
})
```

# Why Vue 2 is not supported
Vue 2 uses the [`with` statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with)
in its code, but the `with` statement is forbidden in ES modules and strict mode. And because Reboost uses native
ES modules, `with` statements will give an error. That's why Vue 2 is not supported.

# License
Licensed under the [MIT License](/LICENSE).
