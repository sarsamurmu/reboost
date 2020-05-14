# Reboost
Reboost your web development workflow.

> ### Experimental.
> Reboost is still in the alpha stage. Some things might not work.

## Motivation
When developing a web app, as your number of modules increases,
your compile-time slows down, it's really a big problem, it takes a lot of precious
time which you could have used to develop your app. Since ES2015 (aka ES6) modules
are supported natively by browsers. If you can connect (or you can say serve) them
up correctly, it will work on browsers without the need for bundling. Here, Reboost
does that for you - the serving part. So you can develop your app faster.

## How to use
First, install it using npm as devDependency
```shell
npm i -D reboost
```
Assume that file structure is like this
```
Project
  public
    index.html
  src
    add.js
    subtract.js
    index.js
  package.json
```
Script contents
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
and HTML content (`public/index.html`)
```html
<!doctype html>
<html>
  <body>
    <!-- Notice the type is "module" -->
    <script type="module" src="./dist/bundle.js">
  </body>
</html>
```

then create a file named `reboost.config.js`. Here's the file content
```js
module.exports = {
  entries: [
    // Format - [inputPath, outputPath]
    ['./src/index.js', './public/dist/bundle.js']
  ],
  contentServer: {
    root: './public'
  }
}
```
after that run Reboost using CLI, open your terminal in that directory and use the command
```shell
npx reboost
```
Now open the address in which the content server is started. You can see your code is working without any problem.

#### What if I want to use any other server?
If you want to use any other server you can do that, you've to just serve the generated
scripts which are in your output directory. Reboost will handle the rest.

### Options
There are a few options, for now. Options are not yet documented, but you can see
`ReboostConfig` interface in [index.ts](https://github.com/sarsamurmu/reboost/blob/master/src/index.ts)
for basic configuration options.

### Plugins
Plugins support is in the alpha stage, they can change anytime. For now, there's only
one plugin - esbuild.

#### TypeScript
You can use esbuild plugin to compile your TypeScript files. Example configuration file for
TypeScript support -
```js
const { plugins } = require('reboost');

module.exports = {
  entries: [
    // This is just an example
    ['./src/index.ts', './public/dist/bundle.js']
  ],
  resolve: {
    // For resolving TypeScript files without typing extension every time
    extensions: ['.ts', '.js']
  },
  plugins: [
    plugins.esbuild({
      loaders: ['ts'],
      target: 'es2018'
    })
  ]
}
```

#### JSX
esbuild plugin can even compile JSX. Example configuration -
```js
const { plugins } = require('reboost');

module.exports = {
  entries: [
    // This is just an example
    ['./src/index.js', './public/dist/bundle.js']
  ],
  resolve: {
    // For resolving JSX files without typing extension every time
    extensions: ['.jsx', '.js']
  },
  plugins: [
    plugins.esbuild({
      loaders: ['jsx']
    })
  ]
}
```

#### Transforming new ECMAScript features
[esbuild](https://github.com/evanw/esbuild) is an awesome transformer, you can transform
new ECMAScript features too which are not yet supported by browsers. See 
[Syntax support](https://github.com/evanw/esbuild#syntax-support) section of esbuild for more info.
Example configuration
```js
const { plugins } = require('reboost');

module.exports = {
  entries: [
    // This is just an example
    ['./src/index.js', './public/dist/bundle.js']
  ],
  plugins: [
    plugins.esbuild({
      loaders: ['js'],
      target: 'es2018' // Supported by most browsers
    })
  ]
}
```

### How it is fast?
- No bundling
- Transforms only the file which is requested or changed
- Caches transformed files, so it can serve fast if the file hasn't changed

### Inspired by
Reboost is highly inspired by these awesome projects
- [Vite](https://github.com/vuejs/vite)
- [Snowpack](https://github.com/pikapkg/snowpack)
- [esbuild](https://github.com/evanw/esbuild)

# License
Licensed under the [MIT License](https://github.com/sarsamurmu/reboost/blob/master/LICENSE).
