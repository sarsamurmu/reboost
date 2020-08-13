# Plugin API
With Plugin API you can make almost any tool work with Reboost.

In Reboost plugins are just objects, with some properties.
Your plugin package should export a function that returns the Reboost plugin compatible object.

### Sample plugin
Here's an example of a sample plugin, which logs to console on startup

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
#### `name`
Type: `string`

The name of your plugin. This field is always required.

#### `setup`
Type: `function`

Executes when Reboost starts up. You can start your services,
add server functionality, or do the initial setup in this function.

The first argument of this function is an object with the following properties -
- `config` - The configuration object passed when starting Reboost.
- `proxyServer` - The [`Koa`](https://koajs.com/) app instance used by the Reboost's proxy server.
- `contentServer` - The [`Koa`](https://koajs.com/) app instance used by the Reboost's content server.
- `resolve` - Same as plugin context's [`resolve`](#resolve-func) function
- `chalk` - The [`chalk`](https://www.npmjs.com/package/chalk) module

#### `stop`
Type: `() => void`

Used to stop the plugin. The provided function should
stop any running service started by the plugin.

#### `resolve`
Type: `(importedPath: string, importer: string) => string`

Used to resolve imported paths.

If your plugin's main purpose is to resolve file paths or needs to resolve
specific paths, use this hook. The first argument is the path to resolve,
the second argument is an absolute path from which the path should be resolved.
This function should return the resolved path, the path should be absolute.

#### `load`
Type: `(filePath: string) => { code: string; type: string; map?: RawSourceMap; }`

Used to load the code of a file.

The first argument is the absolute path
to the file which should be loaded. This function should return an object with
two required properties and one optional property. The required properties are
`code` and `type`. `code` should be a string of the file's content.
`type` should represent the type of the file, for example, the type for `file.js`
should be `js`, for `file.svelte` it should be `svelte`, but it doesn't mean the
type should always be the extension of the file if you know the type of `file.xyz` is
CSS you should return `css`, hope you understand what I mean. The optional property is
`map`, if the file is already transformed before being loaded, the `map` property
should represent the source map of the transformations.

#### `transformContent`
Type: `(data: { code: string; type: string; map: RawSourceMap }, filePath) => Error | { code: string; map: RawSourceMap; type?: string; }`

Used to transform the code as a string.

The first argument is an object with the following properties -
- `code` - The code to transform
- `type` - The type of the code
- `map` - Source map object for the code, it can be `null` at this point

The second argument is the absolute path to the file from which the `code` was loaded.

You should do your transformation in this function and return an object with
two required and one optional property. The required properties are `code` and `map`.
`code` should be the code after transformations. `map` should be a source map object
which maps all the transformations done. The optional property is `type` if the
transformation changes the type of the file, `type` should be the current type of the
file.

You can also return an `Error` instance if any kind of error occurred in your transformations.

#### `transformIntoJS`

Same as [`transformContent`](#transformcontent), but it should return the JavaScript version
of any type of file. For example, if your file's type is CSS, this hooks should return the
JavaScript representation of the CSS file.

#### `transformJSContent`

Same as [`transformContent`](#transformcontent), but this hook is only executed if the
`type` is JavaScript, if the `type` is not JavaScript, this hook will not get called.

#### `transformAST`
Type: `(ast: ASTNode, babel: { traverse: BabelTraverse; types: BabelTypes; }, filePath: string) => void`

Used to transform the JavaScript AST.

The first argument is the babel generated AST of the code.
The second argument is an object which includes two properties -
- `traverse` - Babel's [`traverse` function](https://babeljs.io/docs/en/babel-traverse)
- `types` - Babel's [`types`](https://babeljs.io/docs/en/babel-types)

The third argument is the absolute path to the file from which the AST is generated.

### Plugin Context
The plugin context holds some useful data/functions, which can help you in different hooks.
Plugin Context is available in the following hooks -
- `load`
- `transformContent`
- `transformIntoJS`
- `transformJSContent`
- `transformAST`

You can access it using `this` inside of the hook function.
For example
```js
module.exports = function plugin() {
  return {
    transformContent() {
      const pluginContext = this; // `this` is our plugin context
    }
  }
}
```

Here are all the items available in plugin context

#### `config`
The configuration object passed when starting Reboost.

#### `addDependency`
Type: `(dependency: string) => void`

You can use this function to inform Reboost about other dependencies used
in a file, so that Reboost can watch the dependency files for changes.
Like, SassPlugin uses it to mark dependencies of a `sass` file, which Reboost
could not understand.

The first argument should be the absolute path to the dependency file.

#### `chalk`
The [`chalk`](https://www.npmjs.com/package/chalk) module.

#### `getCompatibleSourceMap`
Type: `(map: RawSourceMap) => RawSourceMap`

This function takes a source map object and returns a
normalized, Reboost compatible source map object.

#### `getSourceMapComment`
Type: `(map: any) => string`

This function takes a source map object and returns the
generated comment string for the source map object.

#### `MagicString`
The [`magic-string`](https://www.npmjs.com/package/magic-string) class.

#### `mergeSourceMaps`
Type: `(oldMap: RawSourceMap, newMap: RawSourceMap) => RawSourceMap`

This function takes two source map object and merges them into a
source map object. The first argument should be the old source map and
the second argument should be the new source map.

For example
```js
module.exports = function plugin() {
  return {
    transformContent() {
      // Assume `transform` is a function which transforms our code
      // and return the transformed code and source map
      const [firstTransformed, firstMap] = transform(someCode);
      const [secondTransformed, secondMap] = transform(firstTransformed);

      // This is our merged source map of two transformation phases
      const mergedMap = this.mergeSourceMaps(firstMap, secondMap);
    }
  }
}
```

<div id="resolve-func"></div>

#### `resolve`
Type: `(basePath: string, requestedPath: string, overrides?: Partial<ResolveOptions>) => string`

This function takes two/three arguments, the first one is the base path, the second one is the requested path,
then it returns the resolved path. You can use it to resolve modules, relative imports, etc. The third
argument can be [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve)'s resolve options,
which will be then merged with the resolve option used in the configurations and will be
used as the resolve option to resolve the requested path.

## Support/Help
If you are having problems making a plugin you can open an issue on this repository.
For references, you can also explore [the built-in and the official plugins](plugins.md)' source code.
