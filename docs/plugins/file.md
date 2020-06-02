# FilePlugin
Load files by importing them from JavaScript.

## Usage
### Setup
Import `FilePlugin` and `UsePlugin` from Reboost.
```js
const { start, FilePlugin, UsePlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, FilePlugin, UsePlugin } = require('reboost');

start({
  plugins: [
    UsePlugin({
      test: /.(png|jpg|jpeg)$/i,
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
const { start, FilePlugin, UsePlugin } = require('reboost');

start({
  plugins: [
    UsePlugin({
      test: /.(png|jpg|jpeg)$/i, // We want to load only PNG and JPG as file
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
