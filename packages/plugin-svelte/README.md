[![npm](https://img.shields.io/npm/v/@reboost/plugin-svelte?style=flat-square)](https://www.npmjs.com/package/@reboost/plugin-svelte)
[![license](https://img.shields.io/npm/l/@reboost/plugin-svelte?style=flat-square)](/LICENSE)

# Svelte Plugin
Adds support for `.svelte` files. Enables Hot Reloading in Svelte components.

## Usage
### Setup
Install it using `npm`
```shell
npm i -D @reboost/plugin-svelte
```
Install `svelte` package, if not already installed
```shell
npm i svelte
```
Import it from the package
```js
const { start } = require('reboost');
const SveltePlugin = require('@reboost/plugin-svelte');
```
Add it to the plugins array
```js
const { start } = require('reboost');
const SveltePlugin = require('@reboost/plugin-svelte');

start({
  plugins: [
    SveltePlugin({
      // Options
    })
  ]
})
```
### Require file in your code
```js
import Component from './file.svelte';
```

## Options
#### `configFile`
Type: `string`\
Default: `./svelte.config.js`

Path to Svelte config file.

#### `preprocess`
Type: `object | array`

Preprocessor plugin(s) to use with Svelte. You can grab some plugins from
Svelte's [community-maintained preprocessing plugins](https://github.com/sveltejs/integrations#preprocessors).

## Example
### Using preprocessors
[svelte-preprocess](https://www.npmjs.com/package/svelte-preprocess)
is an official preprocessor plugin which can transform
PostCSS, SCSS, Pug, and more. Let's see how we can use it
with Svelte.

```js
const { start, DefaultConfig } = require('reboost');
const SveltePlugin = require('@reboost/plugin-svelte');
const sveltePreprocess = require('svelte-preprocess');
const { pug, scss } = require('svelte-preprocess');

start({
  // ...
  plugins: [
    SveltePlugin({
      // Auto detect compatible languages
      // and transform them
      preprocess: sveltePreprocess({ /* Options */ }),

      // You can also use stand-alone preprocessors
      preprocess: [
        pug({ /* Options */ }),
        scss({ /* Options */ })
      ]
    })
  ]
})
```
If you've enabled SCSS preprocessor, you can now use
SCSS syntax in your Svelte files, like so
```html
<style lang="scss">
.card {
  padding: 10px;
  background-color: dodgerblue;

  h1 {
    font-weight: normal;
  }

  p {
    text-align: justify;
  }
}
</style>

<div class="card">
  <h1>Svelte</h1>
  <p>A cool tagline</p>
</div>
```

### Automatic file resolving
You have to always type `.svelte` extension to import Svelte
files. You can set up automatic import using
[`resolve.extensions`](https://github.com/sarsamurmu/reboost/blob/primary/docs/configurations.md#resolveextensions) option

```js
const { start, DefaultConfig } = require('reboost');
const SveltePlugin = require('@reboost/plugin-svelte');

start({
  resolve: {
    extensions: ['.svelte', ...DefaultConfig.resolve.extensions]
  },
  plugins: [
    SveltePlugin()
  ]
})
```

Now you can write
```js
import App from './file';
```
instead of
```js
import App from './file.svelte';
```

# License
Licensed under the [MIT License](/LICENSE).
