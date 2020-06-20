# Sass Plugin
Transform Sass/SCSS files to CSS on the fly.

## Usage
### Setup
1. Install it using `npm`
```shell
npm i @reboost/plugin-sass -D
```
2. Install `node-sass` or `sass` (whichever you like), if not installed
```shell
npm i node-sass -D
```
or
```shell
npm i sass -D
```
3. Import it from the package
```js
const { start } = require('reboost');
const SassPlugin = require('@reboost/plugin-sass');
```
4. Add it to the plugins array
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
