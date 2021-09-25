[![npm](https://img.shields.io/npm/v/@reboost/plugin-litcss?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-litcss)
[![license](https://img.shields.io/npm/l/@reboost/plugin-litcss?style=flat-square)](/LICENSE)

## LitCSS Plugin
Easily load stylesheets as LitCSS style modules.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-litcss
```
Install `lit` package, if not already installed
```shell
npm i lit
```
Import it from the package, also import built-in `UsePlugin`
```js
const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const LitCSSPlugin = require('@reboost/plugin-litcss');
```
Add it to the plugins array
```js
const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const LitCSSPlugin = require('@reboost/plugin-litcss');

start({
  plugins: [
    UsePlugin({
      include: '**/*.lit.css',
      use: LitCSSPlugin()
    })
  ]
});
```
### Require file in your code
```js
import style from './file.lit.css';
```

## Example
### Basic usage with `lit`
`reboost.js`
```js
const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const LitCSSPlugin = require('@reboost/plugin-litcss');

start({
  // ...
  plugins: [
    UsePlugin({
      include: '**/*.lit.css',
      use: LitCSSPlugin()
    })
  ]
});
```
`styles.lit.css`
```css
.main {
  font-family: sans-serif;
  font-size: x-large;
  background-color: rgb(248, 33, 115);
  color: white;
  padding: 10px;
  display: inline-block;
}
```
`index.js`
```js
import { LitElement, customElement, html } from 'lit';

import style from './styles.lit.css';

@customElement('my-element')
export class MyElement extends LitElement {
  static get styles() {
    return [style];
  }

  render() {
    return html`
      <span class="main">Lit is here!</span>
    `
  }
}
```
