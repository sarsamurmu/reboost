# Sass Plugin
Transform Sass/SCSS files to CSS on the fly.

## Usage
### Setup
This plugin depends on `node-sass` package, so you have to install `node-sass` from npm
```shell
npm i -D node-sass
```
Then import `SassPlugin` from Reboost
```js
const { start, SassPlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, SassPlugin } = require('reboost');

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
import 'styles.scss';
```

## Options
#### `sassOptions`
Type: `Sass.Options | object`

Options to use when rendering Sass/SCSS files. You can read about all Sass options
in `node-sass`'s [npm package](https://www.npmjs.com/package/node-sass) page.
