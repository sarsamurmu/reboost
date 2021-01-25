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

The first parameter of this function is an object with the following properties -
- `config` - The configuration object passed when starting Reboost.
- `proxyServer` - The [`Koa`](https://koajs.com/) app instance used by the Reboost's proxy server.
- `contentServer` - The [`Koa`](https://koajs.com/) app instance used by the Reboost's content server.
- `resolve` - Same as plugin context's [`resolve`](#resolve-func) function.
- `chalk` - The [`chalk`](https://www.npmjs.com/package/chalk) module.
- `instance` - Internal Reboost instance object.

#### `stop`
Type: `() => void`

Used to stop the plugin. The provided function should
stop any running service started by the plugin.

#### `getCacheKey`
Type: `(utils: object) => string`

Used to get the cache key of the plugin. This is a required field.

Reboost caches all files in the disk. You can use this function to return
a cache key associated with the plugin. Whenever cache key changes Reboost invalidates
the old cache and generates a new cache with new contents.

Imagine you built a plugin that transforms files with transformer version 1. Then
it got a new major update and in the new version the transformer
transforms all file in a new different way. Even if your users update your plugin,
they won't see any difference, because Reboost would serve it from the cache,
there's no way Reboost get to know that your plugin received a breaking change and
transforms files in a new way. So to let Reboost know that the cache should be invalidated,
you will have to provide a new cache key using this function. Same with your plugins options,
even if your user changes the plugin's options, they won't see the change because all of
the files would get served from the cache. So you should always provide a cache key using this function.

The first parameter is a object that contains utility function. The utility functions are -
- `serializeObject` -
  A function which serializes an object into a string. This function takes two arguments.
  
  The first argument should be an object which will get serialized.

  The second argument is optional. This should be an array of object paths that should
  not be included in the serialized object.

  You may ask, "So what's the difference with `JSON.stringify()`?". Unlike `JSON.stringify`
  it sorts the properties (so result is consistent across runs) and can serialize regular expressions and functions.

  You can use this function to serialize your options object and use it as
  the cache key.

  ```js
  function Plugin() {
    return {
      getCacheKey({ serializeObject }) {
        const object = {
          a: 1,
          b: 2,
          nest: {
            e: 1,
            f: 7
          }
        };

        serializeObject(object)
        // => A string of the serialized object

        serializeObject(object, ['b', 'nest.f'])
        // => A string of the serialized object,
        // without including property 'b' and 'f' property of 'nest'
      }
    }
  }
  ```

Here's a complete example
```js
// Schema of our options object
/*
{
  include: RegExp;
  logWarning: boolean;
}
*/

function Plugin(options) {
  return {
    getCacheKey({ serializeObject }) {
      return serializeObject(options, [
        'logWarning'
        // => We are not including this property in cache key, cause
        // logging about warning should not affect our code transformation
      ])
    }
  }
}
```

#### `resolve`
Type: `(importedPath: string, importer: string) => string`

Used to resolve imported paths.

If your plugin's main purpose is to resolve file paths or needs to resolve
specific paths, use this hook. The first parameter is the path to resolve,
the second parameter is an absolute path from which the path should be resolved.
This function should return the resolved path, the path should be absolute.

#### `load`
Type: `(filePath: string) => { code: string; type: string; map?: RawSourceMap; }`

Used to load the code of a file.

The first parameter is the absolute path
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

The first parameter is an object with the following properties -
- `code` - The code to transform
- `type` - The type of the code
- `map` - Source map object for the code, it can be `null` at this point

The second parameter is the absolute path to the file from which the `code` was loaded.

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
Type: `(programPath: NodePath<Program>, estreeToolkit: object, filePath: string) => void`

Used to transform the JavaScript AST.

The first parameter is the generated AST of the code wrapped in a [NodePath](https://github.com/sarsamurmu/estree-toolkit/blob/main/src/nodepath.ts).
The AST used is [ESTree AST](https://github.com/estree/estree).

The second parameter is an object which includes all exports of [`estree-toolkit`](https://github.com/sarsamurmu/estree-toolkit).

The third parameter is the absolute path to the file from which the AST is generated.

Example plugin which reverses all strings in a JavaScript file.
```js
function Plugin() {
  return {
    transformProgram(programPath) {
      programPath.traverse({
        Literal(path) {
          if (typeof path.node.value === 'string') {
            path.node.value = path.node.value.split('').reverse().join('');
          }
        }
      })
    }
  }
}
```

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

#### `addDependency`
Type: `(dependency: string) => void`

You can use this function to inform Reboost about other dependencies used
in a file, so that Reboost can watch the dependency files for changes.
Like, SassPlugin uses it to mark dependencies of a `sass` file, which Reboost
could not understand.

The first argument should be the absolute path to the dependency file.

#### `chalk`
The [`chalk`](https://www.npmjs.com/package/chalk) module.

#### `config`
The configuration object passed when starting Reboost.

#### `emitWarning`
Type: `(message: string, color: boolean) => void`

Logs the `message` to the console. The message is colored yellow,
if you don't want this behavior pass `color` to `false`.

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

#### `meta`
A object that you can use to append data. You can use this to
pass any data to other plugins.

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

#### `rootRelative`
Type: `(filePath: string) => string`

Just a utility function to get the root directory relative file path of a file.
```js
const path = require('path');

function Plugin() {
  return {
    transformContent(_, filePath) {
      const relativePath = path.relative(this.config.rootDir, filePath);
      // This is same as
      const relativePath = this.rootRelative(filePath);
    }
  }
}
```

## Support/Help
If you are having problems making a plugin you can open an issue on this repository.
For references, you can also explore [the built-in and the official plugins](plugins.md)' source code.
