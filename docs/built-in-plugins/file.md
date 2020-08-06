# File Plugin
Load file URLs by importing them from JavaScript.

## Usage
### Setup
Import `FilePlugin` and `UsePlugin`
```js
const {
  start,
  builtInPlugins: {
    FilePlugin,
    UsePlugin
  }
} = require('reboost');
```
Add it to the plugins array
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
Here `file` should be an URL to your file, you can use the URL wherever
URLs are supported

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
      include: /.(png|jpg|jpeg)$/i, // We want to load only PNG and JPG as file URLs
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
