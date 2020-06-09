# UsePlugin
Use plugins based on [anymatch](https://www.npmjs.com/package/anymatch) pattern.

## Usage
### Setup
Import `UsePlugin` from Reboost.
```js
const { start, UsePlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, UsePlugin } = require('reboost');

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

[Anymatch](https://www.npmjs.com/package/anymatch) pattern to test file paths.
If test passes all plugin(s) in `use` will be used for the file.

#### `exclude`
Type: `Matcher`

[Anymatch](https://www.npmjs.com/package/anymatch) pattern to test file paths.
If test passes the file will be excluded.

#### `use`
Type: `ReboostPlugin | ReboostPlugin[]`

Plugin(s) to use if the test passes for a file.


## Example
With the following configuration, `FilePlugin` will be used for all files ending with `.png`.

```js
const { start, UsePlugin } = require('reboost');

start({
  plugins: [
    UsePlugin({
      test: /.png$/
      use: FilePlugin()
    })
  ]
})
```
