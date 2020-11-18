# Use Plugin
Use plugins based on [`anymatch`](https://www.npmjs.com/package/anymatch) patterns.

## Usage
### Setup
Import `UsePlugin`
```js
const {
  start,
  builtInPlugins: {
    UsePlugin
  }
} = require('reboost');
```
Add it to the plugins array
```js
const {
  start,
  builtInPlugins: {
    UsePlugin
  }
} = require('reboost');

start({
  plugins: [
    UsePlugin({
      include: /regex/,
      use: [
        // Plugins
      ]
    })
  ]
})
```

## Options
#### `include`
Type: `Matcher`

[`anymatch`](https://www.npmjs.com/package/anymatch) pattern to test file paths.
If the test passes all plugin(s) in `use` will be used for the file.

#### `exclude`
Type: `Matcher`

[`anymatch`](https://www.npmjs.com/package/anymatch) pattern to test file paths.
If the test passes the file will be excluded.

#### `use`
Type: `ReboostPlugin | ReboostPlugin[]`

Plugin(s) to use if the test passes for a file.


## Example
### Simple
With the following configuration, `FilePlugin` will be used for all files ending with `.png`.

```js
const {
  start,
  builtInPlugins: {
    FilePlugin,
    UsePlugin
  }
} = require('reboost');

start({
  plugins: [
    UsePlugin({
      include: /\.png$/
      use: FilePlugin()
    })
  ]
})
```

### Multiple plugins
You can use multiple plugins -
```js
UsePlugin({
  include: '**/some-glob/*',
  use: [
    Plugin1(),
    Plugin2(),
    // and more
  ]
})
```

### Multiple rules
Also, you can pass multiple rules/options, like so
```js
UsePlugin(
  {
    include: '**/some-glob/*',
    use: Plugin1()
  },
  {
    include: '**/another-glob/*',
    use: Plugin2()
  }
)
```

### Relative globs
You can use relative globs, they would be resolved against [rootDir](../configurations.md#rootdir).

```js
UsePlugin({
  include: './src/**/*.js',
  use: Plugin()
})
```
