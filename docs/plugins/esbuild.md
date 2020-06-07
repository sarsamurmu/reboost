# esbuildPlugin
[esbuild](https://github.com/evanw/esbuild) is a fast and powerful transformer,
which you can use to transform TypeScript, JSX, or newer ECMAScript features.

## Usage
### Setup
Import `esbuildPlugin` from Reboost
```js
const { start, esbuildPlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, esbuildPlugin } = require('reboost');

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
  js: 'jsx',
  jsx: 'jsx',
  mjs: 'jsx',
  ts: 'tsx',
  tsx: 'tsx'
}
```

An object containing key as file type and value as the loader to use for the file type.

#### `jsxFactory`
Type: `string`\
Default: `React.createElement`

Factory function to use when transforming JSX or TSX files.

#### `jsxFragment`
Type: `string`\
Default: `React.Fragment`

The component to use as fragment.

#### `target`
Type: `'esnext' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020'`

The ECMAScript version esbuild should target when transforming files.

## Example
### Transforming new ECMAScript features
See [Syntax support](https://github.com/evanw/esbuild#syntax-support) section
of esbuild for more info.

```js
const { start, esbuildPlugin } = require('reboost');

start({
  entries: [
    // This is just an example
    ['./src/index.js', './public/dist/bundle.js']
  ],
  plugins: [
    esbuildPlugin({
      target: 'es2018' // Supported by most browsers
    })
  ]
})
```
