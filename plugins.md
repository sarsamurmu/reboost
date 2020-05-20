# Plugins
All built-in plugins of Reboost.
- [esbuild](#esbuild)
- [replace](#replace)

## esbuild
[esbuild](https://github.com/evanw/esbuild) is a fast and powerful transformer,
which you can use to transform TypeScript, JSX, or newer ECMAScript features.

### Usage
First import plugins from Reboost
```js
const { start, plugins } = require('reboost');
```
then add `esbuild` plugin it to `plugins`
```js
const { start, plugins } = require('reboost');

start({
  plugins: [
    plugins.esbuild({
      // Options
    })
  ]
})
```

### Options
##### `loaders`
Type: `('js' | 'jsx' | 'ts' | 'tsx')[]`

File types which esbuild should handle.

Examples

If you want esbuild to handle your JSX files
```js
const { start, plugins } = require('reboost');

start({
  plugins: [
    plugins.esbuild({
      loaders: ['jsx']
    })
  ]
})
```

If you want esbuild to handle your ts and tsx files
```js
const { start, plugins } = require('reboost');

start({
  plugins: [
    plugins.esbuild({
      loaders: ['ts', 'tsx']
    })
  ]
})
```

##### `jsxFactory`
Type: `string`

Factory function to use when transforming JSX or TSX files. Defaults to `React.createElement`.

##### `jsxFragment`
Type: `string`

The component which will be used for fragments. Defaults to `React.Fragment`.

##### `target`
Type: `'esnext' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020'`

The ECMAScript version esbuild should target when transforming files.

### Samples
Samples for transforming files with esbuild.

#### TypeScript
```js
const { start, plugins } = require('reboost');

start({
  entries: [
    // This is just an example
    ['./src/index.ts', './public/dist/bundle.js']
  ],
  resolve: {
    // For resolving TypeScript files without typing extension every time
    extensions: ['.ts', '.js']
  },
  plugins: [
    plugins.esbuild({
      loaders: ['ts'],
      target: 'es2018'
    })
  ]
})
```

#### JSX
```js
const { start, plugins } = require('reboost');

start({
  entries: [
    // This is just an example
    ['./src/index.js', './public/dist/bundle.js']
  ],
  resolve: {
    // For resolving JSX files without typing extension every time
    extensions: ['.jsx', '.js']
  },
  plugins: [
    plugins.esbuild({
      loaders: ['jsx']
    })
  ]
})
```

#### Transforming new ECMAScript features
See [Syntax support](https://github.com/evanw/esbuild#syntax-support) section
of esbuild for more info.
Example configuration
```js
const { start, plugins } = require('reboost');

start({
  entries: [
    // This is just an example
    ['./src/index.js', './public/dist/bundle.js']
  ],
  plugins: [
    plugins.esbuild({
      loaders: ['js'],
      target: 'es2018' // Supported by most browsers
    })
  ]
})
```

## replace
A plugin that you can use to replace strings in your code.

### Usage
First import plugins from Reboost
```js
const { start, plugins } = require('reboost');
```
then add `replace` plugin it to `plugins`
```js
const { start, plugins } = require('reboost');

start({
  plugins: [
    plugins.replace({
      'to-replace': 'replacement'
    })
  ]
})
```

Example\
If you want to replace `process.env.NODE_ENV` with `production`
```js
const { start, plugins } = require('reboost');

start({
  plugins: [
    plugins.replace({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
})
```
