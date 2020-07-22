# esbuild Plugin
[esbuild](https://github.com/evanw/esbuild) is a fast and powerful transformer,
which you can use to transform TypeScript, JSX, or newer ECMAScript features.

**NOTE**: `esbuild` does not do type checking. Type checking should be handled
by your IDE/Code editor or by yourself. If you were using `tsc` to compile your
TypeScript code, you can use it to just do type checking by using the command
`tsc --noEmit` (if you want `tsc` to watch for changes, use the command `tsc --noEmit -w`).

## Usage
### Setup
1. Import `esbuildPlugin`
```js
const {
  start,
  builtInPlugins: {
    esbuildPlugin
  }
} = require('reboost');
```
2. Add it to the plugins array
```js
const {
  start,
  builtInPlugins: {
    esbuildPlugin
  }
} = require('reboost');

start({
  plugins: [
    esbuildPlugin({
      // Options
    })
  ]
})
```

## Options
#### `loaders`
Type: `object`\
Default:
```js
{
  js: 'tsx',
  jsx: 'tsx',
  mjs: 'tsx',
  es6: 'tsx',
  es: 'tsx',
  ts: 'tsx',
  tsx: 'tsx'
}
```

An object containing key as file type and value as the loader to use for the file type.

#### `jsx`
Type: `object`

Options for JSX

##### `jsx.factory`
Type: `string`\
Default: `React.createElement`

Factory function to use for creating JSX elements.

##### `jsx.fragment`
Type: `string`\
Default: `React.Fragment`

Component to use as the fragment component.

#### `target`
Type: `'esnext' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020'`\
Default: `'es2020'`

The ECMAScript version esbuild should target when transforming files.

#### `minify`
Type: `boolean`\
Default: `true`

Minify the generated code. Enabling it improves performance.

#### `define`
Type: `object`\
Default: `{ 'process.env.NODE_ENV': '"development"' }`

Substitute the keys of the object with their values.

For example, this config
```js
const {
  start,
  builtInPlugins: {
    esbuildPlugin
  }
} = require('reboost');

start({
  // ...
  plugins: [
    esbuildPlugin({
      define: {
        'process.env.NODE_ENV': JSON.stringify('development')
      }
    })
  ]
})
```
will transform this code
```js
const mode = process.env.NODE_ENV;
```
into
```js
const mode = 'development';
```
