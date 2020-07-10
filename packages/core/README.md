# Reboost
[![npm](https://img.shields.io/npm/v/reboost?style=flat-square)](https://www.npmjs.com/package/reboost)
[![license](https://img.shields.io/npm/l/reboost?style=flat-square)](https://github.com/sarsamurmu/reboost/blob/primary/LICENSE)

Reboost is a *super fast* web dev server for faster development.

> ***Experimental***\
> Reboost is in early development, and some things may
> change/break before we hit version 1.0

**NOTE:**
Reboost is intended to use only on development, for production you've to
bundle up your files by yourself using bundlers like Webpack, Rollup, etc.

## Features
- **No bundling**. So the server start time is *fast*.
- Transforms only the **required/changed files**.
- Uses advanced **filesystem cache + memory cache**. It will stay fast even after restarting.
- Source maps support for better developer experience.
- Supports **CommonJS modules**.
- Support for Plugins.
- Import resolving.
- Hot Module Replacement.
- Comes with out of the box support for JSON, CSS Modules, JSX, PostCSS, and TypeScript.
- Preprocessor support.
- **Works with [Electron](https://www.electronjs.org/)**.

## What are supported
- ES Modules
- CommonJS Modules
- CSS
- JSON
- CSS Modules
- JSX
- JS/TS Decorators
- Babel
- PostCSS
- Preact
- React
- Sass/SCSS
- Svelte
- TypeScript
- Vue

## Compatibility
Reboost works with both CommonJS and ES modules, so you can try it even
if you are not using ES modules, though using ES modules is recommended.

## Quickstart
### Using `npm init`
Run this command in your terminal
```shell
npm init @reboost/create
```
Then it will ask you to choose template from
[available templates](/packages/create-app/README.md#available-templates).

After that, open the directory where your app is extracted, install dependencies,
then run
```shell
node reboost
```
### Manually creating app
First, install it
```shell
# Using npm
npm i -D reboost

# Using yarn
yarn add -D reboost
```
Assume that file structure is like this
```
public/
  index.html
src/
  add.js
  subtract.js
  index.js
package.json
```
Scripts content
```js
// src/add.js
export const add = (a, b) => a + b;

// src/subtract.js
export const subtract = (a, b) => a - b;

// src/index.js
import { add } from './add';
import { subtract } from './subtract';

console.log('1 + 3 =', add(1, 3));
console.log('10 - 5 =', subtract(10, 5));
```
and HTML content (`public/index.html`)
```html
<!doctype html>
<html>
  <body>
    <!-- Note that the type is "module" -->
    <script type="module" src="./dist/bundle.js"></script>
  </body>
</html>
```

then create a file named `reboost.js`
```js
const { start } = require('reboost');

start({
  entries: [
    // Format - [inputPath, outputPath]
    ['./src/index.js', './public/dist/bundle.js']
  ],
  contentServer: {
    root: './public',
    open: true // Opens the browser
  }
})
```
after that run the script using `node`, open your terminal in that directory and use the command
```shell
node reboost
```
You can see your code is working without any problem!

### What if I want to use any other server?
Reboost's content server is basically static, it just serves the file. If you want
to use any other server (like browser-sync or your own http server) you can do that,
you've to just serve the generated scripts which are in your output directory.
Reboost will handle the rest.

## Docs
[Changelog](/CHANGELOG.md)\
[Configurations](/docs/configurations.md)\
[Plugins](/docs/plugins.md)\
[HMR API](/docs/hmr.md)\
[Recipes](/docs/recipes.md)\
[Supporting old browsers while using `script type="module"`](/docs/supporting-old-browsers.md)

## Motivation
When developing a web app, as your number of modules increases,
your compile-time slows down, it's really a big problem, it takes a lot of precious
time which you could have used to develop your app. Since ES2015 (aka ES6) modules
are supported natively by browsers. If you can connect (or you can say serve) them
up correctly, it will work on browsers without the need for bundling. Here, Reboost
does that for you - the serving part. So you can develop your app faster.

Reboost is highly inspired by these awesome projects - [Vite](https://github.com/vitejs/vite),
[Snowpack](https://github.com/pikapkg/snowpack), [esbuild](https://github.com/evanw/esbuild).

# License
Licensed under the [MIT License](/LICENSE).
