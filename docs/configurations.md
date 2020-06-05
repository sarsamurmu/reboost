# Configurations

There are a few configuration options that you can use to customize Reboost. You would use options when starting
Reboost, like so
```js
const { start } = require('reboost');

start({
  // Options
})
```

### All configurations

#### `cacheDir`
Type: `string`\
Default: `./.reboost_cache`

Directory to use for storing cached files.

#### `contentServer`
Type: `object`

Options for the content server. The content server serves your static
files like HTML. It supports all the options of [koa-static](https://github.com/koajs/static#options)
and some extra options which are described below.

##### `contentServer.root`
Type: `string`

Root directory which will be served by the content server.

##### `contentServer.open`
Type: `boolean | object`

Automatically opens the content server URL when ready. If set to `true`, opens the
URL in your default browser. You can set it to options `object` for more configurations.
The `object` accepts all [open](https://www.npmjs.com/package/open) options.

Here's an example if you want to open the url in Firefox browser
```js
const { start } = require('reboost');

start({
  // ...
  contentServer: {
    open: {
      app: 'firefox'
    }
  }
})
```

Or if you want to open the url in an Incognito tab of Chrome
```js
const { start } = require('reboost');

start({
  // ...
  contentServer: {
    open: {
      app: ['google chrome', '--incognito']
    }
  }
})
```

##### `contentServer.proxy`
Type: `Record<string, string | object>`

Sets up custom proxies in the content server. This option can be an `object` with
keys as paths that you want to redirect and value as a string (shorthand) or
[http-proxy](https://github.com/http-party/node-http-proxy#options) options object.

```js
const { start } = require('reboost');

start({
  // ...
  contentServer: {
    proxy: {
      '/path': 'https://example.com/redirect',
      '/another-path': {
        target: 'https://target.path',
        // More `http-proxy` options
      }
    }
  }
})
```

##### `contentServer.onReady`
Type: `(app: Koa) => void`

Expects a function as the option. The function will be called when the
content server is ready. The first argument is the [Koa](https://koajs.com/) app
instance used by the content server.

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

If you are authoring a library and want all your exports to be available through the
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

#### `plugins`
Type: `ReboostPlugin[]`

An array of plugins to be used by Reboost.

#### `rootDir`
Type: `string`\
Default: `.`

Directory to use as the root directory. Used to resolve relative paths.

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
Instead of using relative paths, you can use aliases.

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
Default: `['.tsx', '.ts', '.jsx', '.mjs', '.js', '.json']`

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

#### `showResponseTime`
Type: `boolean`\
Default: `false`

If want to know how fast Reboost is, enable this ^_^

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

##### `watchOptions.chokidar`
Type: `chokidar.WatchOptions`\
Default: `{}`

Options to use when initializing [chokidar](https://www.npmjs.com/package/chokidar).
