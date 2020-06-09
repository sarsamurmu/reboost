# Sass Plugin
Transform Sass/SCSS files to CSS on the fly.

## Usage
### Setup
This plugin works with both `node-sass` and `sass` package, but it prefers
`node-sass` over `sass`. So you have to install `node-sass` or `sass` from npm,
whichever you like
```shell
npm i -D node-sass
```
or
```shell
npm i -D sass
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
in `node-sass`'s [npm package](https://www.npmjs.com/package/node-sass#options) page.
