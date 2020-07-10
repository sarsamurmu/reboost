[![npm](https://img.shields.io/npm/v/@reboost/plugin-sass?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-sass)
[![license](https://img.shields.io/npm/l/@reboost/plugin-sass?style=flat-square)](/LICENSE)

# Sass Plugin
Transform Sass/SCSS files to CSS on the fly.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-sass
```
Install `node-sass` or `sass` (whichever you like), if not installed
```shell
npm i node-sass
```
or
```shell
npm i sass
```
Import it from the package
```js
const { start } = require('reboost');
const SassPlugin = require('@reboost/plugin-sass');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const SassPlugin = require('@reboost/plugin-sass');

start({
  plugins: [
    SassPlugin({
      // Options
    })
  ]
})
```
### Require file in your code
```js
import './styles.scss';
```

## Options
#### `sassOptions`
Type: `Sass.Options | object`

Options to use when rendering Sass/SCSS files. You can read about all Sass options
in `node-sass`'s [npm package](https://www.npmjs.com/package/node-sass#options) page.

# License
Licensed under the [MIT License](/LICENSE).
