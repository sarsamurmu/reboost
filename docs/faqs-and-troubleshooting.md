## FAQs/Troubleshooting

### Does Reboost support bundling?
Same as the previous question. Reboost doesn't support bundling. You have to use
a bundler (Webpack, Rollup, etc.) to bundle up your files.

### Will Reboost ever support bundling for production
For now, we are only focusing on the development build. We may think about it on
future.

### Something is not working
If something is not working, you can try deleting your cache directory
(which defaults to `.reboost_cache`). If it's still not working then please
[open an issue](https://github.com/sarsamurmu/reboost/issues/new).

### My modules are not working with CommonJS modules
You have to [configure Reboost](/docs/configurations.md#commonjsinterop) to properly
support CommonJS modules.

### `esbuild` is showing error when transforming TypeScript files
By default, Reboost's `esbuildPlugin` treats `ts` files as `tsx` files. This can
cause problems in TypeScript files when generics are used. You can fix it by adjusting
your `reboost.js` file to match this
```js
const { start, builtInPlugins: { esbuildPlugin } } = require('reboost');

start({
  // ... Other options

  plugins: [
    esbuildPlugin({
      loaders: {
        ts: 'ts'
      }
    }),
    
    // ... Other plugins
  ]
});
```

### How can I use <insert_tool_name> with Reboost?
You can use any tool with Reboost as long as you can implement it as a plugin. You can
read more about [how to create a plugin](/docs/plugin-api.md). Also, you can create an issue
about supporting a certain tool, then we will see if we can implement it or not.

### What if I want to use any other server?
Reboost's content server is static, it just serves the file. If you want
to use any other server (like browser-sync or your own HTTP server) you can do that,
you've to just serve the generated scripts which are in your output directory.
Reboost will handle the rest.
