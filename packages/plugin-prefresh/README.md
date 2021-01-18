[![npm](https://img.shields.io/npm/v/@reboost/plugin-prefresh?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-prefresh)
[![license](https://img.shields.io/npm/l/@reboost/plugin-prefresh?style=flat-square)](/LICENSE)

# Prefresh Plugin
Enables support for hot reloading Preact components, so that you can develop your app *faster*.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-prefresh
```
Import it from the package
```js
const { start } = require('reboost');
const PrefreshPlugin = require('@reboost/plugin-prefresh');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const PrefreshPlugin = require('@reboost/plugin-prefresh');

start({
  plugins: [
    PrefreshPlugin({
      // Options
    })
  ]
})
```

## Options
#### `excludeNodeModules`
Type: `boolean`\
Default: `true`

Excludes all files which match `/node_modules/`. Disabling it will decrease performance.

## Minimal setup needed
If you want this plugin to work, please part up your components and renderers to different
files.

#### This won't work
`index.jsx`
```js
import { h, render } from 'preact';

const App = () => {
  return (
    <div>Hi there!</div>
  )
}

render(<App />, document.querySelector('#app'));
```
#### This works
`index.jsx`
```js
import { h, render } from 'preact';
import { App } from './App';

render(<App />, document.querySelector('#app'));
```
`App.jsx`
```js
import { h } from 'preact';

export const App = () => {
  return (
    <div>Hi there!</div>
  )
}
```

Also [see this](https://github.com/JoviDeCroock/prefresh/#recognition).

## Example
### Improving performance by excluding unrelated files
By default, it runs the transformation on all files. You can run the transformation
only on the files which need it by using `UsePlugin`.
```js
const {
  start,
  builtInPlugins: {
    UsePlugin
  }
} = require('reboost');
const PrefreshPlugin = require('@reboost/plugin-prefresh');

start({
  // Other options
  plugins: [
    // Other plugins
    UsePlugin({
      include: /\.[jt]sx?$/, // Selects only the files with .js, .ts, .jsx or .tsx extension
      use: PrefreshPlugin()
    })
  ]
  // ...
})
```

# License
Licensed under the [MIT License](/LICENSE).
