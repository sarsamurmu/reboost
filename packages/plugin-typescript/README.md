[![npm](https://img.shields.io/npm/v/@reboost/plugin-typescript?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-typescript)
[![license](https://img.shields.io/npm/l/@reboost/plugin-typescript?style=flat-square)](/LICENSE)

# TypeScript Plugin
Transpile TypeScript files using the official TypeScript compiler. So that you can
try out new TypeScript features without waiting.

**NOTE**: It does not checks for types. You have to do handle that by yourself. If you are
using the CLI then you can use command `tsc --noEmit` (or `tsc --noEmit --watch`).

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-typescript
```
Install `typescript` package, if not already installed
```shell
npm i typescript
```
Import it from the package
```js
const { start } = require('reboost');
const TypeScriptPlugin = require('@reboost/plugin-typescript');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const TypeScriptPlugin = require('@reboost/plugin-typescript');

start({
  plugins: [
    TypeScriptPlugin({
      // Options
    })
  ]
})
```

## Options
#### `tsconfig`
Type: `string`\
Default: `./tsconfig.json`

Path to the `tsconfig` file.

#### `compatibleTypes`
Type: `string[]`\
Default: `['ts']`

The file types that would be compiled by the plugin. Ex. If you set it to `['js', 'ts']`,
the plugin will also compile JavaScript files.

# License
Licensed under the [MIT License](/LICENSE).
