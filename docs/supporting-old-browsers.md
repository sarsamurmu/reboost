# Supporting old browsers while using `script type="module"`
You may know that `script` with `module` type is only supported by modern browsers
that support ES modules. Old browsers don't know what `script type="module"` is,
so they will just ignore it and break your web app. So how can we fix that?

What you've to do is, generate two bundles from the same script. One bundle will
target ES2015, let's name it `bundle.js` and the other one will target old browsers with
polyfills and other stuff, let's name it `bundle.fallback.js`. In your HTML add them like
```html
<script type="module" src="path/to/bundle.js"></script>
<script nomodule src="path/to/bundle.fallback.js"></script>
```
What does it do? Modern browsers know what `script` with attribute `nomodule` means,
so modern browsers won't load `path/to/bundle.fallback.js` but cause old browsers
don't know what it means, they will load the script as regular scripts. In this way
you can support both old and modern browsers while using `script type="module"`.

*Plus point: Modern browsers will load less code as the code is not 
bloated with polyfills and the page load will be faster for modern browsers.*
