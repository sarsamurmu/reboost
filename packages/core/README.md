<p align="center">
  <img
    src="https://user-images.githubusercontent.com/44255990/87241868-d941a680-c444-11ea-8dbb-8abc674f3911.png"
    alt="Reboost"
    width="300">
</p>

<p align="center">
  <!-- IDK why it's not working -->
  <!-- <a href="https://circleci.com/gh/sarsamurmu/reboost">
    <img alt="CircleCI" src="https://circleci.com/gh/sarsamurmu/reboost.svg?style=svg">
  </a> -->
  <a href="https://www.npmjs.com/package/reboost">
    <img alt="npm" src="https://img.shields.io/npm/v/reboost?style=flat-square">
  </a>
  <a href="https://lerna.js.org">
    <img alt="maintained with lerna" src="https://img.shields.io/badge/maintained%20with-lerna-cc00ff?style=flat-square">
  </a>
  <a href="https://github.com/sarsamurmu/reboost/blob/primary/LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/reboost?style=flat-square">
  </a>
</p>

<p align="center">Reboost is a <i>super fast</i> dev server for rapid web development.
<br>It makes use of native ES modules to enable fast, bundle-less development experience, so you can develop your app faster.
<a href="#what-it-does">Learn more about what it does.</a></p>

## Features
- *No bundling*. So the server start time is *fast*.
- Transforms only the *required/changed files*.
- Uses advanced filesystem cache. It will stay fast even after restarting.
- Complete source maps support for better developer experience.
- Supports *CommonJS modules*.
- Plugin API for extending its capability.
- Enhanced import resolving.
- Built-in Hot Reload API.
- Out of the box support for JSON, CSS Modules, JSX, and TypeScript.
- Preprocessor support using Plugin.
- Combine with any other server.
- Built-in content server with live reload and hot reload for CSS.
- Lots of configurable options.

#### *NOTE*
**Experimental**: Reboost is in early development, and some things may change/break before we hit version 1.0.\
**Only for development build**: Reboost is intended to use only on development, for production you've to
bundle up your files by yourself using bundlers like Webpack, Rollup, etc.

## Quickstart
Run this command in your terminal
```shell
npm init @reboost/app
```
Then it will ask you to choose a template from the
[available templates](/packages/create-app/README.md#available-templates).

After that, open the directory where your app is extracted, install dependencies,
then run
```shell
node reboost
```

If you don't want to use the CLI, you can [manually create an app](/docs/manually-creating-an-app.md).

## Docs
[Changelog](/packages/core/CHANGELOG.md)\
[Configurations](/docs/configurations.md)\
[Plugins](/docs/plugins.md)\
[Plugin API](/docs/plugin-api.md)\
[Hot Reload API](/docs/hot-reload-api.md)\
[Recipes](/docs/recipes.md)\
[FAQs/Troubleshooting](/docs/faqs-and-troubleshooting.md)

## What are supported
- ES Modules
- JS/TS Decorators
- JSON
- [Babel](/docs/recipes.md#babel)
- [CSS and CSS Modules (with Hot Reloading)](/docs/recipes.md#css-and-css-modules)
- [CommonJS Modules](/docs/recipes.md#commonjs-modules)
- [JSX](/docs/recipes.md#jsx)
- [Lit element](/docs/recipes.md#lit-element)
- [Malina.js](/docs/recipes.md#malinajs)
- [PostCSS](/docs/recipes.md#postcss)
- [Preact](/docs/recipes.md#preact)
- [React (with Fast Refresh)](/docs/recipes.md#react-with-fast-refresh)
- [Sass/SCSS](/docs/recipes.md#sass-or-scss)
- [Solid](/docs/recipes.md#solid)
- [Svelte (with Hot Reloading)](/docs/recipes.md#svelte)
- [TSX](/docs/recipes.md#tsx)
- [TypeScript](/docs/recipes.md#typescript)
- [Vue 3 (with Hot Reloading)](/docs/recipes.md#vue-3)
- and almost anything as long as you can implement it as [a plugin](/docs/plugin-api.md)

See the [Recipes](/docs/recipes.md) for many template configurations.

## What it does
When developing a web app, as your number of modules increases,
your compile-time slows down, it's a big problem, it takes a lot of precious
time which you could have used to develop your app. Since ES2015 (aka ES6) modules
are supported natively by browsers. If you can connect (or you can say serve) them
up correctly, it will work on browsers without the need for bundling. Here, Reboost
does that for you - the serving part. So you can develop your app faster.

<!-- Reboost is highly inspired by these awesome projects - [Vite](https://github.com/vitejs/vite),
[Snowpack](https://github.com/pikapkg/snowpack), [esbuild](https://github.com/evanw/esbuild). -->

# License
Licensed under the [MIT License](/LICENSE).

## Thanks for your support
This project is nothing without your support. If you like this project then help us by giving
a star on its GitHub repository 😃
