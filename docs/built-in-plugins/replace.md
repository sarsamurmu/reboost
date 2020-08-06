# Replace Plugin
A plugin that you can use to replace strings in your code.

## Usage
### Setup
Import `ReplacePlugin`
```js
const {
  start,
  builtInPlugins: {
    ReplacePlugin
  }
} = require('reboost');
```
Add it to the plugins array
```js
const {
  start,
  builtInPlugins: {
    ReplacePlugin
  }
} = require('reboost');

start({
  plugins: [
    ReplacePlugin({
      'to-replace': 'replacement'
    })
  ]
})
```

### Example
If you want to replace `process.env.NODE_ENV` with `production`
```js
const {
  start,
  builtInPlugins: {
    ReplacePlugin
  }
} = require('reboost');

start({
  plugins: [
    ReplacePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
})
```
