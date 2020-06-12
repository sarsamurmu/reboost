# Reboost
A *super fast* web dev server, for faster development.

> ***Experimental***\
> Reboost is in early development, and some things may
> change/break before we hit version 1.0

## Motivation
When developing a web app, as your number of modules increases,
your compile-time slows down, it's really a big problem, it takes a lot of precious
time which you could have used to develop your app. Since ES2015 (aka ES6) modules
are supported natively by browsers. If you can connect (or you can say serve) them
up correctly, it will work on browsers without the need for bundling. Here, Reboost
does that for you - the serving part. So you can develop your app faster.

**NOTE:**
Reboost is only for use while you are developing your app, for production you've to
bundle up your files by yourself using bundlers like Webpack, Rollup, etc.

## Features
- No bundling. So the server start time is fast.
- Transforms only the required/changed files.
- Uses advanced filesystem cache + memory cache. It will stay fast even after restarting.
- Source maps support for better developer experience.
- Supports CommonJS modules.
- Support for Plugins.
- Import resolving.
- Hot Module Replacement.
- Out of the box support for JSON, CSS Modules, JSX, PostCSS, and TypeScript.
- Preprocessor support.
- Works with [Electron](https://www.electronjs.org/).

## Compatibility
Reboost works with both CommonJS and ES modules, so you can try it even
if you are not using ES modules, though using ES modules is recommended.

## Quickstart
First, install it using npm as devDependency
```shell
npm i -D reboost
```
Assume that file structure is like this
```
Project
  public/
    index.html
  src/
    add.js
    subtract.js
    index.js
  package.json
```
Script contents
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
[Changelog](https://github.com/sarsamurmu/reboost/blob/master/CHANGELOG.md)\
[Configurations](https://github.com/sarsamurmu/reboost/blob/master/docs/configurations.md)\
[Plugins](https://github.com/sarsamurmu/reboost/blob/master/docs/plugins.md)\
[HMR API](https://github.com/sarsamurmu/reboost/blob/master/docs/hmr.md)\
[Recipes](https://github.com/sarsamurmu/reboost/blob/master/docs/recipes.md)\
[Supporting old browsers while using `script type="module"`](https://github.com/sarsamurmu/reboost/blob/master/docs/supporting-old-browsers.md)

---

## Inspired by
Reboost is highly inspired by these awesome projects
- [Vite](https://github.com/vuejs/vite)
- [Snowpack](https://github.com/pikapkg/snowpack)
- [esbuild](https://github.com/evanw/esbuild)

# License
Licensed under the [MIT License](https://github.com/sarsamurmu/reboost/blob/master/LICENSE).
