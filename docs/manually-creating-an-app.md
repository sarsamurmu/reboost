## Manually creating an app
First, install Reboost
```shell
# Using npm
npm i -D reboost

# Using yarn
yarn add -D reboost
```
Assume that the file structure is like this
```
public/
  index.html
src/
  add.js
  subtract.js
  index.js
package.json
```
Scripts content
```js
// src/add.js
export const add = (a, b) => a + b;

// src/subtract.js
export const subtract = (a, b) => a - b;

// src/index.js
import { add } from './add';
import { subtract } from './subtract';

console.log('1 + 3 =', add(1, 3));
console.log('10 - 5 =', subtract(10, 5));
```
and the HTML content (`public/index.html`)
```html
<!doctype html>
<html>
  <body>
    <!-- Note that the type is "module" -->
    <script type="module" src="./dist/bundle.js"></script>
  </body>
</html>
```

then create a file named `reboost.js`
```js
const { start } = require('reboost');

start({
  entries: [
    // Format - [inputPath, outputPath]
    ['./src/index.js', './public/dist/bundle.js']
  ],
  contentServer: {
    root: './public',
    open: true // Opens the browser
  }
})
```
after that run the script using `node`, open your terminal in that directory and use the command
```shell
node reboost
```
You can see your code is working without any problem.
