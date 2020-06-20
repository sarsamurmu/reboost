# File Plugin
Load files by importing them from JavaScript.

## Usage
### Setup
1. Import `FilePlugin` and `UsePlugin`
```js
const {
  start,
  builtInPlugins: {
    FilePlugin,
    UsePlugin
  }
} = require('reboost');
```
2. Add it to the plugins array
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
      include: /.(png|jpg|jpeg)$/i,
      use: FilePlugin()
    })
  ]
})
```
### Require file in your code
```js
import file from 'path/to/file.png';
```
Here `file` would be an URL to your file which you can use wherever
URL is supported

## Example
### Importing image in JSX
Our configuration
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
      include: /.(png|jpg|jpeg)$/i, // We want to load only PNG and JPG as file
      use: FilePlugin()
    })
  ]
})
```
And in JSX
```js
import imageFile from 'path/to/file.png';

const Logo = () => <img src={imageFile} />;
```
