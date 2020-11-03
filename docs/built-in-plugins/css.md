# CSS Plugin
Adds support for importing CSS files in JavaScript. Enables Hot reload for CSS files.

## Usage
### Setup
Import `CSSPlugin`
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');
```
Add it to the plugins array
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin({
      // Options
    })
  ]
})
```
### Require file in your code
For normal CSS files
```js
import css from './any.css';

// You can use `toString()` method to get the CSS, like so
document.body.innerText = 'The CSS content is ' + css.toString();
```
Or if you are using CSS Modules
```js
import styles from './any.module.css';

// `styles` is object of exported class names
```

## Options
#### `import`
Type: `boolean`\
Default: `true`

Resolves `@import` rules in CSS files, by turning them into JavaScript imports.

Here's some examples
| CSS | JS |
| :-: | :-: |
| `@import "file.css"` <br> or <br> `@import url("file.css")` <br> or <br> `@import url(file.css)` | `import "./file.css"` |
| `@import "dir/file.css"` <br> or <br> `@import url("dir/file.css")` <br> or <br> `@import url(dir/file.css)` | `import "./dir/file.css"` |
| `@import "https://some.url/file.css"` <br> or <br> `@import url("https://some.url/file.css")` | Doesn't resolve this, left untouched |

If you don't want relative imports then you can prefix the import url with a `~`.

Here's an example with `~`
| CSS | JS |
| :-: | :-: |
| `@import "~module/file.css"` <br> or <br> `@import url("~module/file.css")` <br> or <br> `@import url(~module/file.css)` | `import "module/file.css"` |

If you don't want to resolve `@imports` then just set this option to `false`,
it will leave the import rules untouched.

The option's value can also be a function, like so
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin({
      import: (url, filePath) => {
        // url -> The url imported by the `@import` rule
        // filePath -> The path to the CSS file

        // Use the url and filePath to determine
        // if the import should be resolved and
        // return a boolean

        // Dummy code
        return url.includes('image') && filePath.includes('someDir');
      }
    })
  ]
})
```

#### `url`
Type: `boolean`\
Default: `true`

Resolves `url()` and `image-set()` rules in CSS files, by importing them by JavaScript imports
and replacing them with the imported value. You also need [proper loader to load the assets](#loading-urls-using-fileplugin).

Here's some examples
| CSS | JS |
| :-: | :-: |
| `url("image.jpg")` <br> or <br> `url(image.jpg)` | `import "./image.jpg"` |
| `url("dir/image.jpg")` <br> or <br> `url(dir/image.jpg)` | `import "./dir/image.jpg"` |
| `url("https://some.url/image.jpg")` <br> or <br> `url(https://some.url/image.jpg)` | Doesn't resolve this, left untouched |

If you don't want relative urls then you can prefix the url with a `~`.

Here's an example with `~`
| CSS | JS |
| :-: | :-: |
| `url("~module/image.jpg")` <br> or <br> `url(~module/image.jpg)` | `import "module/image.jpg"` |

If you don't want to resolve `url()` and `image-set()` then just set this option to `false`,
it will leave the `url()` and `image-set()` rules untouched.

The option's value can also be a function, like so
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin({
      url: (url, filePath) => {
        // url -> The url imported by the `url()` or `image-set()` rule
        // filePath -> The path to the CSS file

        // Use the url and filePath to determine
        // if the import should be resolved and
        // return a boolean

        // Dummy code
        return url.includes('image') && filePath.includes('someDir');
      }
    })
  ]
})
```

#### `modules`
Type: `boolean | object`\
Default: `true`

Options for CSS modules, `false` disables CSS modules completely,
setting `true` is same as setting the following object as the value
```js
{
  mode: 'local',
  exportGlobals: false,
  test: /\.module\./i
}
```

##### `modules.mode`
Type: `('local' | 'global' | 'pure') | (filePath: string) => 'local' | 'global' | 'pure'`\
Default: `'local'`

Sets `mode` option. Can be `local`, `global`, `pure` or a function which
returns any of these modes based on the file path.

Example with function as the value
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin({
      modules: {
        mode: (filePath) => {
          // Use filePath tp do your checks and return any of the modes

          // Dummy code
          if (/\.pure\./i.test(filePath)) return 'pure';
          if (/\.global\./i.test(filePath)) return 'global';
          return 'local';
        }
      }
    })
  ]
})
```

##### `modules.exportGlobals`
Type: `boolean`\
Default: `false`

Enables global class names or ids to be exported.

##### `modules.test`
Type: `RegExp | ((filePath: string) => boolean)`\
Default: `/\.modules\./i`

Determines which file should be treated as a CSS module.

The option's value can be a regex or a function.

If you use regex, your regex will be tested against file paths.

You can also use a function, like so
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin({
      modules: {
        test: (filePath) => {
          // Use the filePath to determine if
          // it should be a CSS module or not
          // and return a boolean

          // Dummy code
          return filePath.includes('.module.');
        }
      }
    })
  ]
})
```

#### `sourceMap`
Type: `boolean`\
Default: `true`

Enable/disable source map generation for CSS files.

## Example
### Getting the CSS content of a file
If you want the CSS content of any CSS file, just use the `.toString()` method.
Example usage in a Angular component -
```js
import css from './file.css';

@Component({
  selector: 'app-root',
  template: `
    <h1>This is an example</h1>
  `,
  styles: [
    // Here
    css.toString()
  ]
})
export class ExampleComponent {}
```

### Loading URLs using [FilePlugin](./file.md)
This plugin can resolve `url()`'s in your CSS files. But you need another plugin
to load the assets. You can use [FilePlugin](./file.md) in this case.

Example usage
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin,
    FilePlugin,
    UsePlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin(),
    UsePlugin({
      include: /\.(png|svg|jpe?g)/,
      use: FilePlugin()
    })
  ]
});
```
Now you can use `url()` in your CSS file
```css
.card {
  background-image: url("background.png");
}
```


### Using with preprocessor plugins
You can use `CSSPlugin` with CSS preprocessor plugins (like [`SassPlugin`](../../packages/plugin-sass/README.md)),
there's no extra configuration needed to do that.

Example - Using with [`SassPlugin`](../../packages/plugin-sass/README.md)
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');
const SassPlugin = require('@reboost/plugin-sass');

start({
  plugins: [
    CSSPlugin(),
    SassPlugin(),
    // Other plugins which transforms CSS
  ]
})
```

### Treating all CSS files as CSS modules
By default, all CSS files which includes `.module.` in their name are treated as
CSS modules. If you want your all CSS files to be loaded as CSS modules then
you can use `modules.test` option to change this behavior.
```js
const {
  start,
  builtInPlugins: {
    CSSPlugin
  }
} = require('reboost');

start({
  plugins: [
    CSSPlugin({
      modules: {
        test: /.*/ // Matches all
      }
    })
  ]
})
```
