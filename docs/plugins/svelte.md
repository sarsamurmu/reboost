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
import Component from 'file.svelte';
```

## Options
#### `configFile`
Type: `string`\
Default: `./svelte.config.js`

Path to Svelte config file.

## Example
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
import App from 'file';
```
instead of
```js
import App from 'file.svelte';
```
