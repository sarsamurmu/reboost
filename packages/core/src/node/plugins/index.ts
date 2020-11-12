export { CSSPlugin } from './css/index';
export { esbuildPlugin } from './esbuild';
export { FilePlugin } from './file';
export { ReplacePlugin } from './replace';
export { UsePlugin } from './use';

// TODO: Remove it in v1.0
export interface PluginOptions {
  CSS: import('./css').CSSPlugin.Options;
  esbuild: import('./esbuild').esbuildPlugin.Options;
  Use: import('./use').UsePlugin.Options;
}
