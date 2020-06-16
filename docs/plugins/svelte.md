# Svelte Plugin
Adds support for `.svelte` files.

## Usage
### Setup
This plugin depends on `svelte` package, so first install `svelte` package from npm
```shell
npm i -D svelte
```
Then import `SveltePlugin` from Reboost
```js
const { start, SveltePlugin } = require('reboost');
```
Add it to the plugins array
```js
const { start, SveltePlugin } = require('reboost');

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
PostCSS, SCSS, Pug and more. Let's see how we can use it
with Svelte.

```js
const { start, DefaultConfig, SveltePlugin } = require('reboost');
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
If you've enabled Sass preprocessor, you can now use
sass syntax in your Svelte files, like so
```html
<style lang="sass">
.card
  padding: 10px
  background-color: dodgerblue

  h1
    font-weight: normal
  
  p
    text-align: justify
</style>

<div class="card">
  <h1>Svelte</h1>
  <p>A cool tagline</p>
</div>
```

### Automatic file resolving
You have to always type `.svelte` extension to import Svelte
files. You can set up automatic import using
[`resolve.extensions`](../configurations.md#resolveextensions) option

```js
const { start, DefaultConfig, SveltePlugin } = require('reboost');

start({
  resolve: {
    extensions: ['.svelte'].concat(DefaultConfig.resolve.extensions)
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
