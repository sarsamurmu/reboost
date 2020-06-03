# Recipes
Here's how you can make Reboost work with different files/frameworks.

## React
Works out of the box.

## Preact
Change configuration to match this
```js
const { start, esbuildPlugin } = require('reboost');

start({
  // Other options
  plugins: [
    // Other plugins
    esbuildPlugin({
      jsxFactory: 'h',
      jsxFragment: 'Fragment'
    })
  ]
  // ...
})
```
**NOTE:** For now you have to manually import `h` and `Fragment` from `preact`.

## CSS and CSS Modules
Works out of the box. By default all CSS files are loaded as regular CSS file,
only the files which includes `.module.` in their name are treated as CSS module.
Learn more about this on [`CSSPlugin`'s page](./plugins/css.md)

## Sass
Use [SassPlugin](./plugins/sass.md) to generate CSS out of Sass/SCSS,
generated CSS will be handled by [CSSPlugin](./plugins/css.md).

See the following configuration for adding Sass support.
```js
const { start, SassPlugin } = require('reboost');

start({
  // Other options
  plugins: [
    // Other plugins
    SassPlugin()
  ]
  // ...
})
```

## CSS modules with Sass as preprocessor
As told, files which includes `.module.` are treated as CSS module. So, if
your Sass/SCSS file includes `.module.` in its name, it will be treated as
CSS module.
