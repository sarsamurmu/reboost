# CSS Plugin
Adds support for importing CSS files in JavaScript and HMR for CSS.

## Usage
### Setup
Import `CSSPlugin` from Reboost
```js
const { start, CSSPlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, CSSPlugin } = require('reboost');

start({
  plugins: [
    CSSPlugin({
      // Options
    })
  ]
})
```
### Require file in your code
For normal CSS files
```js
import 'any.css';
```
Or if you are using CSS Modules
```js
import styles from 'any.module.css';

// `styles` is object of exported class names
```

## Options
#### `modules`
Type: `boolean | object`\
Default: `true`

Options for CSS modules, `false` disables CSS modules completely,
setting `true` is same as setting the following object as the value
```js
{
  mode: 'local',
  exportGlobals: false,
  test: /\.module\./i
}
```

##### `modules.mode`
Type: `('local' | 'global' | 'pure') | (filePath: string) => 'local' | 'global' | 'pure'`\
Default: `'local'`

Sets `mode` option. Can be `local`, `global`, `pure` or a function which
returns any of these modes based on the file path.

Example with function as value
```js
const { start, CSSPlugin } = require('reboost');

start({
  plugins: [
    CSSPlugin({
      mode: (filePath) => {
        // Do checks and return any of modes
        // Dummy code
        if (/\.pure\./i.test(filePath)) return 'pure';
        if (/\.global\./i.test(filePath)) return 'global';
        return 'local';
      }
    })
  ]
})
```

##### `modules.exportGlobals`
Type: `boolean`\
Default: `false`

Enables global class names or ids to be exported.

##### `modules.test`
Type: `RegExp`\
Default: `/\.modules\./i`

Determines which file should be treated as CSS modules.

#### `sourceMap`
Type: `boolean`\
Default: `true`

Enable/disable source map generation for CSS files.

## Example
### Using with preprocessor plugins
If want to use `CSSPlugin` with CSS preprocessor plugins (like `SassPlugin`), always
place `CSSPlugin` at the end of those plugins.

Example - Using with `SassPlugin`
```js
const { start, SassPlugin } = require('reboost');

start({
  plugins: [
    SassPlugin(),
    // Other plugins which transforms CSS
    CSSPlugin()
  ]
})
```

### Treating all CSS files as modules
By default all CSS files which includes `.module.` in their name are treated as
CSS modules. If you want your all CSS files to be loaded as CSS modules then
you can use `modules.test` option change this behavior.
```js
const { start, CSSPlugin } = require('reboost');

start({
  plugins: [
    CSSPlugin({
      modules: {
        test: /.*/ // Matches all
      }
    })
  ]
})
```
