# Recipes <!-- omit in toc -->
Here's how you can make Reboost work with different files/frameworks.

Available recipes -
- [Asset files](#asset-files)
- [Babel](#babel)
- [CommonJS modules](#commonjs-modules)
- [CSS and CSS Modules](#css-and-css-modules)
- [CSS modules with Sass](#css-modules-with-sass)
- [JSX](#jsx)
- [Lit](#lit)
- [Malina.js](#malinajs)
- [PostCSS](#postcss)
- [Preact with Fast Refresh](#preact-with-fast-refresh)
- [React](#react)
- [React with Fast Refresh](#react-with-fast-refresh)
- [Sass or SCSS](#sass-or-scss)
- [Solid](#solid)
- [Svelte](#svelte)
- [TSX](#tsx)
- [TypeScript](#typescript)
- [Vue 3](#vue-3)

## Asset files
You can load asset files as well.
Just adjust your configuration file to match this
```js
const {
  start,
  builtInPlugins: {
    FilePlugin,
    UsePlugin
  }
} = require('reboost');

start({
  // Other options
  plugins: [
    // Other plugins
    UsePlugin({
      include: /\.(png|jpe?g)$/, // Example for only loading PNG/JPG/JPEG files as asset
      use: FilePlugin()
    })
  ]
  // ...
})
```
Now you can import your assets in your script files
```js
import logo from './resources/logo.png';

// You can use it in many ways
// But, here using JSX for example
const BrandLogo = () => <img src={logo} height="100px">;
```

## Babel
To enable Babel transformation just enable [BabelPlugin](/packages/plugin-babel/README.md)

BTW, here's an example
```js
const { start, builtInPlugins: { UsePlugin } } = require('reboost');
// NOTE: You have to install @reboost/plugin-babel from npm
const BabelPlugin = require('@reboost/plugin-babel');

start({
  plugins: [
    UsePlugin({
      include: /.*/,
      exclude: /node_modules/,
      use: BabelPlugin({
        plugins: [
          // Your babel plugin,
          // for example
          ['@babel/plugin-proposal-pipeline-operator', { proposal: 'smart' }]
        ]
      })
    })
  ]
})
```

## CommonJS modules
If all of your files are CommonJS module, use this configuration
```js
const { start } = require('reboost');

start({
  // Other options
  commonJSInterop: {
    mode: 1
  }
})
```
Please see [`commonJSInterop`](/docs/configurations.md#commonjsinterop) configuration
for more information and cases.

## CSS and CSS Modules
Works out of the box. By default, all CSS files are loaded as a regular CSS file,
only the files which include `.module.` in their name are treated as CSS module.
Learn more about this on [`CSSPlugin`'s page](./built-in-plugins/css.md).

So basically you can just import CSS modules without any extra configuration.

`buttons.module.css`
```css
.base {
  padding: 10px;
  border-radius: 8px;
}

.primary {
  composes: base-button;
  background-color: dodgerblue;
}
```
`component.js`
```js
import buttons from './buttons.module.css';

// You can use it in many ways
// Here's an example using JSX
const PrimaryButton = () => (
  <button className={buttons.primary}>CSS module works!</button>
);

// If you want the CSS content just use the `toString()` method, like so
const cssContent = buttons.toString();
```

## CSS modules with Sass
As told, files which include `.module.` in their name are treated as CSS module. So, if
your Sass/SCSS file includes `.module.` in its name, it will be treated as
CSS module.

## JSX
JSX transformation is enabled for files with `.jsx` extension. If you want to enable
JSX for every JS file then adjust your configuration to match this
```js
const {
  start,
  builtInPlugins: {
    esbuildPlugin
  }
} = require('reboost');

start({
  // ... Other options

  plugins: [
    esbuildPlugin({
      loaders: {
        js: 'jsx' // or 'tsx' if you want decorators support
      }
    })
    // ... Other plugins
  ]
})
```

## Lit
Works out of the box.

## Malina.js
You can use [MalinaJSPlugin](/packages/plugin-malinajs/README.md) to add support
for [Malina.js](https://github.com/malinajs/malinajs). Adjust your configuration to match this.
```js
const { start } = require('reboost');
// NOTE: You have to install @reboost/plugin-malinajs from npm
const MalinaJSPlugin = require('@reboost/plugin-malinajs');

start({
  // Other options
  plugins: [
    MalinaJSPlugin(),
    // Other plugins
  ],
  // ...
})
```

## PostCSS
You can use [PostCSSPlugin](/packages/plugin-postcss/README.md) to use PostCSS with Reboost.
Adjust your configuration to match this.
```js
const { start } = require('reboost');
// NOTE: You have to install @reboost/plugin-postcss from npm
const PostCSSPlugin = require('@reboost/plugin-postcss');

start({
  // Other options
  plugins: [
    PostCSSPlugin(),
    // Other plugins
  ],
  // ...
})
```

## Preact with Fast Refresh
Change configuration to match this
```js
const { start, builtInPlugins: { esbuildPlugin } } = require('reboost');
// NOTE: You have to install @reboost/plugin-prefresh from npm
const PrefreshPlugin = require('@reboost/plugin-prefresh');

start({
  // Other options
  plugins: [
    // Other plugins
    esbuildPlugin({
      jsx: {
        factory: 'h',
        fragment: 'Fragment'
      }
    }),
    // If you want to enable fast refresh with preact
    PrefreshPlugin()
  ]
  // ...
})
```
**NOTE:** For now you have to manually import `h` and `Fragment` from `preact`.
```js
import { h, Fragment } from 'preact';

const CompFrag = () => (
  <>
    <p>Some text</p>
  </>
)
```

## React
Works out of the box.

## React with Fast Refresh
Change configuration to match this
```js
const { start } = require('reboost');
// NOTE: You have to install @reboost/plugin-react-refresh from npm
const ReactRefreshPlugin = require('@reboost/plugin-react-refresh');

start({
  // Other options
  plugins: [
    // Other plugins
    ReactRefreshPlugin()
  ]
})
```

## Sass or SCSS
Use [SassPlugin](/packages/plugin-sass/README.md) to generate CSS out of Sass/SCSS,
generated CSS will be handled by [CSSPlugin](./built-in-plugins/css.md).

Following configuration file adds support for Sass.
```js
const { start } = require('reboost');
// NOTE: You have to install @reboost/plugin-sass from npm
const SassPlugin = require('@reboost/plugin-sass');

start({
  // Other options
  plugins: [
    // Other plugins
    SassPlugin()
  ]
  // ...
})
```

After that, you can import Sass/SCSS files in your script files
```js
import './styles.scss';
```

## Solid
Using Solid with Reboost is pretty easy. Adjust your configuration to match this
```js
// NOTE: You have to install these additional npm packages
// - @reboost/plugin-babel
// - babel-preset-solid

const { start, builtInPlugins: { UsePlugin } } = require('reboost');
const BabelPlugin = require('@reboost/plugin-babel');

start({
  entries: [
    ['./src/index.jsx', './public/dist/index.js']
  ],
  contentServer: {
    root: './public',
    open: true
  },
  plugins: [
    UsePlugin({
      include: /.*/,
      exclude: /node_modules/,
      use: BabelPlugin({
        presets: [require('babel-preset-solid')]
      })
    })
  ]
});
```

## Svelte
Use [SveltePlugin](/packages/plugin-svelte/README.md). Adjust your configuration to match this
```js
const { start, DefaultConfig } = require('reboost');
// NOTE: You have to install @reboost/plugin-svelte from npm
const SveltePlugin = require('@reboost/plugin-svelte');

start({
  // Other options
  resolve: {
    // Adds support for resolving `.svelte` files
    extensions: ['.svelte', ...DefaultConfig.resolve.extensions],

    // Prefer `svelte` field to load script from `package.json`
    mainFields: ['svelte', ...DefaultConfig.resolve.mainFields]
  },
  plugins: [
    // ... Other plugins
    SveltePlugin()
  ]
  // ...
})
```
Hot Reloading is also enabled by the plugin.

## TSX
TSX transformation is enabled for files with `.tsx` extension. If you want to enable
TSX for every TS file then adjust your configuration to match this
```js
const {
  start,
  builtInPlugins: {
    esbuildPlugin
  }
} = require('reboost');

start({
  // ... Other options

  plugins: [
    esbuildPlugin({
      loaders: {
        ts: 'tsx'
      }
    })
    // ... Other plugins
  ]
})
```

## TypeScript
TypeScript is supported out of the box. But, note that it just compiles
your TypeScript code and does not do type checking. Type checking should be handled
by your IDE/Code editor or by yourself. If you were using `tsc` to compile your
TypeScript code, you can use it to do type checking by using the command
`tsc --noEmit` (if you want `tsc` to watch for changes, use the command `tsc --noEmit -w`).

Also, you can use the default [TypeScriptPlugin](/packages/plugin-typescript/README.md).

## Vue 3
Reboost supports Vue 3 using [VuePlugin](/packages/plugin-vue/README.md).
Hot Reload feature comes built-in with the plugin.

Change configuration to match this
```js
const { start } = require('reboost');
const VuePlugin = require('@reboost/plugin-vue');

start({
  // Other options
  plugins: [
    // Other plugins
    VuePlugin()
  ]
  // ...
})
```
