## 0.12.0
- New CommonJS interoperability mode with better interoperability
- New option `mode` to set mode.
  For example - set it to `development` or `production`
- Added option `path` in PostCSS plugin
- Updated dependencies

## 0.11.0
- Removed unused dependencies
- Made it ore lightweight
- Added `stop` function to stop Reboost
- Improve Plugin API
- `HMR` is now `Hot Reload`

## 0.10.1
- Added timestamp to file change logs
- Proxy server now supports reconnecting
- Content server now logs file change
- Improved response time logger
- Fixed bug with cache refreshing
- Improved `create-app` templates
- Updated dependencies

## 0.10.0
- Added support for live reload in content server
- Reorganized options for content server
- Added new option `port` to `config.contentServer`
- Fixed bug with HMR
- Properly exported types
- Updated dependencies
- Lots of minor fixes

## 0.9.0
- Fixed esbuild plugin warning
- Fixed security issues
- Fixed React Refresh plugin
- Now appends library name to `self` instead of `window`
- Enabled new resolve option - `conditionNames`
- Added documentation for Plugin API
- Updated dependencies

## 0.8.0
- Improved proxy server
- Updated dependencies
- Added new `import.meta` fields
- Fixed bug with cache deletion
- Added support for using custom reload mechanism in HMR
- Now uses `enhanced-resolve` to resolve paths
- Major rework on HMR, Added new methods -
  - `hot.self.decline`
  - `hot.decline`
  - `hot.invalidate`

## 0.7.0
- Updated dependencies
- Set esbuild plugin's default target to `es2020`
- Fixed `import.meta.url`
- Improved CommonJS interoperability
- Content server can now show directories
- Now supports symbolic links

## 0.6.0
- Improve Plugin API
- Resolver
  - Fix infinite loop when `"main": '.'` in `package.json`
  - Fix module directory resolving. Now also checks directory in ancestors
  - Added support for parsing `browser` fields in `package.json`
  - Added new option `roots` to `ReboostConfig['resolve']`
  - Cache results for faster path resolving
- Added React Fast Refresh plugin
- Updated dependencies

## 0.5.11
- Removed unused codes
- Minor fixes

## 0.5.10
- Improved Plugin API

## 0.5.9
- Vue plugin: New option `compiler`
- Update dependencies
- Minor fixes

## 0.5.8
- Fixed module resolving algorithm

## 0.5.7
- Fixed Vue plugin
- Published `@reboost/create-app`
- Added many templates
- Updated docs
- Updated dependencies

## 0.5.5
- Updated dependencies

## 0.5.4
- Added support for Vue
- Minor fixes

## 0.5.2
- Fixed `typescript` being installed as dependency

## 0.5.1
- Minor fixes

## 0.5.0
- Moved to monorepo
- Fixed bug with `window.process`

## 0.4.3
- Enabled decorators support

## 0.4.2
- Fix source maps

## 0.4.1
- Fixed error with PostCSS

## 0.4.0
- Fix CommonJSPlugin
- New memory caching system. Now its 20-30x faster
- Fixed import resolving with absolute paths
- Added `BabelPlugin`
- `esbuildPlugin` now shows better error and warning messages

## 0.3.0
- Improved SassPlugin
- Enabled CommonJS interop for all files
- UsePlugin: Added option `exclude`
- MASSIVE performance improvement
- Support for `.es6` and `.es` files
- Now generates correct source map for Svelte files
- Fixed error with CommonJS interop plugin
- Updated dependencies

## 0.2.2
- Addded SveltePlugin
- Added new resolve options - `resolve.mainFields`

## 0.2.1
- Fixed error in PostCSS plugin

## 0.2.0
- Added PostCSSPlugin
- Minor fixes

## 0.1.3
- Support for automatically opening browser
- Support for proxies
- Minor fixes
- Updated dependencies
- Updated docs

## 0.1.0
- Improved Plugin API with Plugin Context
- Better source maps
- Added support for `hot.data` and `hot.id`
- Fixed resolve with built-in modules
- Updated dependencies
- `esbuild` is now included by default
- Out of the box support for CSS and CSS modules
- New plugins
  - CSSPlugin
  - FilePlugin
  - SassPlugin
  - UsePlugin
- Fixed CommonJS interop plugin
- Fixed HMR
- Better error messages
- Improved file system cache
- Now supports dynamic imports

## 0.0.7
- Added support for HMR
- Improved plugins
- Minor fixes

## 0.0.6
- Added replace plugin
- Improved API
- Improved CommonJS support by adding CommonJS interoperability

## 0.0.5
- Improved module resolving
- Added support for CommonJS modules
- New Plugins API
- Added JSON loader
- Updated Docs

## 0.0.3
- Fixed alias resolving
- Fixed scoped package resolving
- Fixed TypeScript types
- Updated Docs
- Better error messages

## 0.0.1
- First release
