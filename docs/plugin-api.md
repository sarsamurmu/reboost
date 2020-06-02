Documentation coming soon

<!-- ## Plugin API
Reboost plugins are objects with function as properties.
A plugin object can contain five properties - `name`, `setup`, `resolve`,
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
#### `name`
Type: `string`

The name of your plugin.

#### `setup`
Type: `(config: ReboostConfig, app: Koa, router: Router) => void`

Executes when Reboost starts. You can start your services,
add server functionality, or do the initial setup in this function.
The first argument is the configuration options object which is passed
when starting Reboost. The second argument is the [Koa](https://koajs.com/)
app instance used by Reboost. The third argument is a [koa-router](https://github.com/koajs/router) instance used by koa.

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

All of these functions can be `async` as well. -->
