# Reboost
Reboost your web development workflow.

> ### Experimental.
> Reboost is still in the alpha stage. Some things might not work. API can change any time.

## Motivation
When developing a web app, as your number of modules increases,
your compile-time slows down, it's really a big problem, it takes a lot of precious
time which you could have used to develop your app. Since ES2015 (aka ES6) modules
are supported natively by browsers. If you can connect (or you can say serve) them
up correctly, it will work on browsers without the need for bundling. Here, Reboost
does that for you - the serving part. So you can develop your app faster.

**NOTE:**
1. Reboost only serves your scripts while developing, for production you've to
bundle up your files by yourself using bundlers like Webpack, Rollup, etc.
2. ~~For now, only ES modules are supported.~~ Reboost now supports CommonJS modules!

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
    <!-- Notice the type is "module" -->
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
    root: './public'
  }
})
```
after that run the script using `node`, open your terminal in that directory and use the command
```shell
node reboost
```
Now open the address in which the content server is started. You can see your code is working without any problem.

### What if I want to use any other server?
Reboost's content server is basically static, it just serves the file. If you want
to use any other server (like browser-sync or your own http server) you can do that,
you've to just serve the generated scripts which are in your output directory.
Reboost will handle the rest.

### Supporting old browsers while using `script type="module"`
You may know that `script` with `module` type is only supported by modern browsers
that support ES modules. Old browsers don't know what `script type="module"` is,
so they will just ignore it and break your web app. So how can we fix that?

What you've to do is, generate two bundles from the same script. One bundle will
target ES2015, let's name it `bundle.js` and the other one will target old browsers with
polyfills and other stuff, let's name it `bundle.fallback.js`. In your HTML add them like
```html
<script type="module" src="path/to/bundle.js"></script>
<script nomodule src="path/to/bundle.fallback.js"></script>
```
What does it do? Modern browsers know what `script` with attribute `nomodule` means,
so modern browsers won't load `path/to/bundle.fallback.js` but cause old browsers
don't know what it means, they will load the script as regular scripts. In this way
you can support both old and modern browsers while using `script type="module"`.

*Plus point: Modern browsers will load less code as the code is not 
bloated with polyfills and the page load will be faster for modern browsers.*

## Features
- No bundling. So the server start time is fast.
- Incremental Builds, transforms only the file which is requested or changed.
- Caches transformed files, so it can serve fast if the file hasn't changed.
- Source maps support for better debugging.
- Supports CommonJS modules.
- Plugin support.

## How it works?
1. Reboost starts a proxy server
2. It rewrites scripts so that all imports are served from the proxy server
3. When files are requested from the proxy server, the server checks
if the requested file is available in the cache, it returns the cached file,
if not available it transforms the file so that all imports of the file are served from
the proxy server then it returns the transformed file and saves the transformed file
to cache. Step 3 repeats again for other files.


## Configurations
There are a few configuration options that you can use to customize Reboost. You would use options when starting
Reboost, like so
```js
const { start } = require('reboost');

start({
  // Options
})
```

List of all options

#### `cacheDir`
Type: `string`\
Default: `./.reboost_cache`

Path of the directory to use for storing cached files.


#### `entries`
Type: `([string, string] | [string, string, string])[]`

File entries which will be served by Reboost. Value is an array of an array containing input
and the output file's path

For single file
```js
const { start } = require('reboost');

start({
  entries: [
    [inputPath, outputPath]
    // Example - ['./src/index.js', './dist/bundle.js']
  ]
})
```

For multiple files
```js
const { start } = require('reboost');

start({
  entries: [
    [inputPath1, outputPath1],
    [inputPath2, outputPath2],
    ...
    [inputPathN, outputPathN],
  ]
})
```

If you're authoring a library and want all your exports to be available through the
`window` object with a name you can pass an extra string in your array

`src/index.js`
```js
export const add = (a, b) => a + b;
export const subtract = (a, b) => a - b;
```
`reboost.js`
```js
const { start } = require('reboost');

start({
  entries: [
    ['./src/index.js', './dist/library.js', 'coolLib']
    //                                       ^^^ This is our library name
  ]
})
```
In browser
```js
window.coolLib // Module { add: (...), subtract: (...) }
```
As you expected, exports are available through the `window` object

#### `rootDir`
Type: `string`\
Default: `.`

Path of the directory to use as the root directory. Used to resolve relative paths.

#### `resolve`
Type: `object`

Configurations for module and file resolving

##### `resolve.alias`
Type: `{ [aliasName: string]: string }`\
Default: `{}`

Paths to use when resolving aliases, create your own alias to ease importing.

Example

```js
const { start } = require('reboost');

start({
  resolve: {
    alias: {
      Components: './components'
    }
  }
})
```
Instead of using relative paths you can use alias.

Some deeply nested file -
```js
import ProgressBar from '../../../components/progressbar';
```
Now you can do
```js
import ProgressBar from 'Components/progressbar';
```

##### `resolve.extensions`
Type: `string[]`\
Default: `['.mjs', '.js', '.json']`

Extensions to use for resolving files.

```js
// If you use `['.js']`
import mod from './mod';
// resolves to
import mod from './mod.js';
```

It returns the first file with the first matched extension, so extension ordering matters.

##### `resolve.mainFiles`
Type: `string[]`\
Default: `['index']`

File names to use while resolving directories.

```js
// If you use `['index']`
import main from './subdir';
// resolves to
import main from './subdir/index';
```

##### `resolve.modules`
Type: `string[]`\
Default: `['node_modules']`

Directories to use while resolving modules.

#### `watchOptions`
Type: `object`

Options to use for watching files

##### `watchOptions.include`
Type: `Matcher`\
Default: `/.*/`

Files to include in the watch-list. Can be any of [anymatch](https://www.npmjs.com/package/anymatch)
patterns. By default, all files are watched except for excluded files.

##### `watchOptions.exclude`
Type: `Matcher`\
Default: `/node_modules/`

Files to exclude from watch-list. Can be any of [anymatch](https://www.npmjs.com/package/anymatch)
patterns. By default, all files which are in `node_modules` are excluded.

#### `sourceMaps`
Type: `object`

Options to use when generating source maps.

##### `sourceMaps.include`
Type: `Matcher`\
Default: `/.*/`

Files to include in source map generation. Can be any of [anymatch](https://www.npmjs.com/package/anymatch)
patterns. By default, source maps are generated for all files.

##### `sourceMaps.exclude`
Type: `Matcher`\
Default: `/node_modules/`

Files to exclude from source map generation. Can be any of [anymatch](https://www.npmjs.com/package/anymatch)
patterns. By default, all files which are in `node_modules` are excluded.

#### `plugins`
Type: `ReboostPlugin[]`

An array of plugins to be used by Reboost.

## Plugins
There are several built-in plugins from Reboost.
[Read more about built-in plugins](https://github.com/sarsamurmu/reboost/blob/master/plugins.md).

## Plugin API
Reboost plugins are objects with function as properties.
A plugin object can contain five properties - `setup`, `resolve`,
`load`, `transformContent`, `transformAST`.
Your plugin package should export a function that returns the Reboost plugin compatible object.

### Sample Plugin
Here's an example of a sample plugin, which logs when it starts

```js
// sample-plugin.js
module.exports = function samplePlugin() {
  return {
    setup() {
      console.log(`Sample plugin is starting`);
    }
  }
}

// reboost.js
const { start } = require('reboost');
const samplePlugin = require('./sample-plugin.js');

start({
  entries: [
    ['./src/index.js', './public/dist/bundle.js']
  ],
  plugins: [
    samplePlugin()
  ]
});
```

### All plugin properties
#### `setup`
Type: `(config: ReboostConfig) => void`

Called once when Reboost starts. You can start your
services or do the initial setup in this function. The first argument is
the configuration options object which is passed when starting Reboost.

#### `resolve`
Type: `(importPath: string, importer: string) => string`

Used to resolve an import path. If your plugin is a resolver or needs
to resolve specific paths, use this hook. The first argument is the path
being used to import a file, the second argument is the absolute path to
the file which is using the import path. This function should return an
absolute path to the file being imported.

#### `load`
Type: `(filePath: string) => { code: string; original?: string; map?: string; }`

Used to load the code of a file. The first argument is the absolute path
to the file which should be loaded. This function should return an object with
one required property and two optional properties. The required property is
`code`, `code` should be a string of JavaScript code, most of the time
made by transforming the original code. The optional properties are `original` and `map`,
if your loaded `code` is transformed, you should set `original` property to the
original source string of the file and `map` to the source map string which maps the
transformations made to the file.

#### `transformContent`
Type: `(sourceCode, filePath) => { code: string; map: string; }`

Used to transform the code as a string. The first argument is the source code of
a file and the second argument is the absolute path to the file from which the source code
is generated. You should do your transformation in this function and return an object with
two properties - `code` and `map`. `code` should be the code which is generated after
your transformations and `map` should be a string of source map which maps all the
transformations made.

#### `transformAST`
Type: `(ast: ASTNode, babel: { traverse: BabelTraverse; types: BabelTypes; }, filePath: string) => void`

Used to transform the AST. The first argument is the AST of the code.
The second argument is an object which includes two properties -
`traverse` - Babel's [traverse function](https://babeljs.io/docs/en/babel-traverse)
and `types` - Babel's [types](https://babeljs.io/docs/en/babel-types). The third
argument is the absolute path to the file from which the AST is generated.

All of these functions can be `async` as well.

---

### Inspired by
Reboost is highly inspired by these awesome projects
- [Vite](https://github.com/vuejs/vite)
- [Snowpack](https://github.com/pikapkg/snowpack)
- [esbuild](https://github.com/evanw/esbuild)

# License
Licensed under the [MIT License](https://github.com/sarsamurmu/reboost/blob/master/LICENSE).
