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

#### `cacheOnMemory`
Type: `boolean`\
Default: `false`

Enables file caching on memory. Improves response speed as it reads
cached files from memory instead of the file system. May cause problems
if you are working on a very large project.

#### `commonJSInterop`
Type: `object`

Options for CommonJS interoperability.

##### `commonJSInterop.mode`
Type: `0 | 1 | 2`\
Default: `2`

Mode to use for interoperability with CommonJS modules.

If you set it to `0`, it disables CommonJS interop completely.

If you set it to `1`, it transforms your file in the following way to
support CommonJS modules -
- Transformation for ES modules
```js
// Before
import Def from 'mod1';
import { part1, part2 } from 'mod2';
import * as star from 'mod3';

// After transformation
// Importer is an object with helper functions
import _importer from '/importer';

import * as _import1 from 'mod1';
const Def = _importer.Default(_import1);

import * as _import2 from 'mod2';
const part1 = _importer.Member(_import2, 'part1'),
      part2 = _importer.Member(_import2, 'part2');

import * as _import3 from 'mod3';
const start = _importer.All(_import3);
```
- Transformation for CommonJS modules
```js
// Before
const mod = require('mod');

module.exports.some = someExport;
exports.other = someOtherExport;

// After transformation
import _importer from '/importer';
import * as _import1 from 'mod';
const module = {
  exports: {}
};
const exports = module.exports;

const mod = _importer.All(_import1);

module.exports.some = someExport;
exports.other = someOtherExport;

export const __cjsExports = module.exports;
```
This mode will work in almost all situations. But there are also some trade-offs when
using this mode. In this mode every import is constant, they are not live, it means
exported `let` variables won't update. Let's see an example, here's what happens in
real ES modules, you can read more about it [here](https://exploringjs.com/es6/ch_modules.html#sec_imports-as-views-on-exports)
```js
// counter.js
export let count = 0;
export function increase() {
  count++;
}

// lib.js
import { count, increase } from './counter.js';

console.log(count); // 0
increase();
console.log(count); // 1
increase();
console.log(count); // 2
```
So as you can see, In the module, exported variables reflect their value everywhere they
are imported. In Reboost if you use CommonJS interop mode `1`, every import will turn constant
and they won't reflect their original value if changed.

But to the rescue, there is another mode. If you use CommonJS interop mode `2`, it will transform
your files in the following way to support interoperability. It only transforms CommonJS modules,
not ES modules
```js
// Before
const mod = require('mod');

module.exports.some = someExports;
exports.other = someOtherExport;

// After transformation
import * as _import1 from 'mod';
const __commonJS = mod => mod.__cjsModule ? mod['default'] : mod;
const exports = {};
const module = { exports };

let _export_0, _export_1;

const mod = __commonJS(_import1);

module.exports.some = someExports;
_export_0 = module.exports.some;
exports.other = someOtherExport;
_exports_1 = exports.other;

export { _export_0 as some, _export_1 as other }
export default module.exports;
export const __cjsModule = true;
```
In this way module imports in ES modules are no longer constant, they reflect their live values everywhere.
This mode is default and recommended.

**Tips**
- If you are using CommonJS as your default module style, use mode `1`.
- If you are using ES modules with CommonJS modules
  - Use mode `1` if you don't mind live binding.
  - Use mode `2` if you want to use CommonJS and also want live binding.
- If you know that every module you are using in your project are ES modules
  (including your dependencies), use mode `0`. It will increase performance.

##### `commonJSInterop.include`
Type: `Matcher`

Files to transform to support interoperability. This option only makes sense in mode `2`,
it has no effects on mode `1`. When set to mode `2`, this option defaults to `/node_modules|\.cjs/`,
meaning that every file in `node_modules` directory and files which has `.cjs` extension
will be transformed to support interoperability.

##### `commonJSInterop.exclude`
Type: `Matcher`

Same as `commonJSInterop.include`, but for excluding files. In mode `2` it defaults to
`() => false`, meaning that no file will be excluded which are included.

#### `contentServer`
Type: `object | object[]`

Options for the content server. The content server serves your static
files like HTML, CSS, JS, images, etc. It also accepts an array of objects
if you want to launch multiple content servers.

Example - Single content server
```js
const { start } = require('reboost');

start({
  contentServer: {
    root: './public'
  }
})
```
Example - Multiple content servers
```js
const { start } = require('reboost');

start({
  contentServer: [
    {
      name: 'Server one'
      root: './dir-1'
    },
    {
      name: 'Server two',
      root: './dir-2'
    }
  ]
})
```

##### `contentServer.name`
Type `string`\

Sets the name of the content server. Useful when you are launching multiple
content servers.

##### `contentServer.basePath`
Type: `string`\
Default: `/`

All content files will be available under this path.

Assume that your server is running on `http://localhost:8000`. If you have file named `index.html`,
it will be available on `http://localhost:8000/index.html`. If you set `basePath` to `/some-path`,
now the `index.html` should be available on `http://localhost:8000/some-path/index.html`.

##### `contentServer.etag`
Type: `boolean`\
Default: `true`

Enable ETag in content server.

##### `contentServer.extensions`
Type: `string[]`\
Default: `['.html']`

Extensions to resolve when no extension is present in the URL.

##### `contentServer.hidden`
Type: `boolean`\
Default: `false`

If the content server should serve the hidden files or not.

##### `contentServer.index`
Type: `string`\
Default: `index.html`

Name of the index file to serve automatically when serving a directory.

##### `contentServer.middleware`
Type: `Koa.Middleware | Koa.Middleware[]`

Middleware(s) to use with the content server's [`Koa`](https://koajs.com) app instance.

##### `contentServer.open`
Type: `boolean | object`\
Default: `false`

Automatically opens the content server URL in a browser when ready. If set to `true`, opens the
URL in your default browser. You can also use an `object` for more configurations.
The `object` accepts all [`open`](https://www.npmjs.com/package/open) options.

Here's an example if you want to open the URL in Firefox browser
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

Or if you want to open the URL in an Incognito tab of Chrome
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

##### `contentServer.port`
Type: `number`

Port to use for the content server. Fallbacks to any available port when the
given port is unavailable.

##### `contentServer.proxy`
Type: `object`

Sets up custom proxies in the content server. This option can be an `object` with
key as the path that you want to redirect and value as a string (shorthand) or
[`http-proxy`](https://github.com/http-party/node-http-proxy#options) options object.

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

##### `contentServer.root`
Type: `string`

Root directory which will be served by the content server.

##### `contentServer.serveIndex`
Type: `string`\
Default: `true`

Serves directory listing for directories that don't have an index file.

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

#### `externalHost`
Type: `string | boolean`\
Default: `true`

Enable/disable external host feature. Set a string of IPv4 address to
set the external host address.

#### `hotReload`
Type: `boolean`\
Default: `true`

Enables/disables [Hot Reload API](./hot-reload-api.md).

#### `includeDefaultPlugins`
Type: `boolean`\
Default: `true`

Include the default plugins, like [`CSSPlugin`](./built-in-plugins/css.md) and [`esbuildPlugin`](./built-in-plugins/esbuild.md).

#### `log`
Type: `false | object`

Options for message logging in Reboost.

If set to `false`, it disables the message logging completely.

The following properties can be passed if you use an `object`.

##### `log.info`
Type: `boolean`\
Default: `true`

Enables/disables logging about general information.

##### `log.responseTime`
Type: `boolean`\
Default: `false`

Enables/disables logging about how much time it took to transform a file and give a response.

##### `log.watchList`
Type: `boolean`\
Default: `true`

Enables/disables logging about which files are being added or removed from the watch list.

#### `mode`
Type: `string`\
Default: `'development'`

The mode to set as `process.env.NODE_ENV`.

#### `plugins`
Type: `ReboostPlugin[]`

An array of plugins to be used by Reboost.

#### `rootDir`
Type: `string`\
Default: `process.cwd()`

Directory to use as the root directory. This path will be used to resolve all relative paths
in the configuration.

#### `resolve`
Type: `object`

Configurations for module and file resolving. Reboost internally uses [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve)
as default file resolver. `enhanced-resolve` is also used by `webpack`, so you may be already
familiar with these options. Though many options are supported by `enhanced-resolve`,
only the following options are configurable by the user, other options are overridden internally by Reboost.

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

##### `resolve.aliasFields`
Type: `string[]`\
Default: `['browser']`

Description file fields to use for parsing aliases.
[See the specification](https://github.com/defunctzombie/package-browser-field-spec).

##### `resolve.conditionNames`
Type: `string[]`\
Default: `['import', 'require', 'node', 'default']`

Condition fields to check while resolving [conditional exports](https://nodejs.org/api/esm.html#esm_conditional_exports).

##### `resolve.descriptionFiles`
Type: `string[]`\
Default: `['package.json']`

JSON files to use as description files when resolving module directories and normal directories.

##### `resolve.enforceExtension`
Type: `boolean`\
Default: `false`

If `true`, enforces extensions when resolving relative paths,
if the extension is not in the import path, resolving will just not work.

##### `resolve.exportsFields`
Type: `string[]`\
Default: `['exports']`

Description file fields to use for parsing conditional exports. To learn more about what
conditional exports are, [See official docs](https://nodejs.org/api/esm.html#esm_conditional_exports).

##### `resolve.extensions`
Type: `string[]`\
Default: `['.tsx', '.ts', '.jsx', '.mjs', '.js', '.es6', '.es', '.json']`

Extensions to use for resolving files' extensions.

```js
// If you use `['.js']`
import mod from './mod';
// resolves to
import mod from './mod.js';
```

It returns the first file with the first matched extension, so extension ordering matters.

##### `resolve.mainFields`
Type: `string[]`\
Default: `['module', 'main']`

Description file fields to be used for resolving the script file.

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

Directory names to search for requested modules. If a relative path is provided, it scans the directory
and its ancestors for the module. If an absolute path is provided, then it searches for the module
only in the given directory.

##### `resolve.restrictions`
Type: `string[]`

Path to directories that should be excluded when resolving paths.

##### `resolve.symlinks`
Type: `boolean`\
Default: `true`

If `true`, resolves symbolic links to their original path.

#### `sourceMaps`
Type: `object`

Options to use when generating source maps.

##### `sourceMaps.include`
Type: `Matcher`\
Default: `/.*/`

Files to include in source map generation. Can be any of [`anymatch`](https://www.npmjs.com/package/anymatch)
patterns. By default, source maps are generated for all files.

##### `sourceMaps.exclude`
Type: `Matcher`\
Default: `/node_modules/`

Files to exclude from source map generation. Can be any of [`anymatch`](https://www.npmjs.com/package/anymatch)
patterns. By default, all files which are in `node_modules` are excluded.

#### `watchOptions`
Type: `object`

Options to use for watching files

##### `watchOptions.include`
Type: `Matcher`\
Default: `/.*/`

Files to include in the watch-list. Can be any of [`anymatch`](https://www.npmjs.com/package/anymatch)
patterns. By default, all files are watched except for excluded files.

It only watches the files which are requested. So file watcher won't bloat up
watching unnecessary files.

##### `watchOptions.exclude`
Type: `Matcher`\
Default: `/node_modules/`

Files to exclude from watch-list. Can be any of [`anymatch`](https://www.npmjs.com/package/anymatch)
patterns. By default, all files which are in `node_modules` are excluded.

##### `watchOptions.chokidar`
Type: `chokidar.WatchOptions`\
Default: `{}`

Options to use when initializing [`chokidar`](https://www.npmjs.com/package/chokidar).

---
**Referenced Types**\
`AnymatchPattern`: `string | RegExp | (testString: string) => boolean`\
`Matcher`: `AnymatchPattern | AnymatchPattern[]`\
`chokidar.WatchOptions`: See - https://www.npmjs.com/package/chokidar#persistence
