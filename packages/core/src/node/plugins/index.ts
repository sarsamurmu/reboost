export { CSSPlugin } from './css';
export { esbuildPlugin } from './esbuild';
export { FilePlugin } from './file';
export { PostCSSPlugin } from './postcss';
export { ReplacePlugin } from './replace';
export { UsePlugin } from './use';

import { CSSPluginOptions } from './css';
import { esbuildPluginOptions } from './esbuild';
import { PostCSSPluginOptions } from './postcss';
import { UsePluginOptions } from './use';

export interface PluginOptions {
  CSS: CSSPluginOptions;
  esbuild: esbuildPluginOptions;
  PostCSS: PostCSSPluginOptions;
  Use: UsePluginOptions;
}
