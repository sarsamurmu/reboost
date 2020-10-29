export { CSSPlugin } from './css/index';
export { esbuildPlugin } from './esbuild';
export { FilePlugin } from './file';
export { ReplacePlugin } from './replace';
export { UsePlugin } from './use';

import { CSSPluginOptions } from './css/index';
import { esbuildPluginOptions } from './esbuild';
import { UsePluginOptions } from './use';

export interface PluginOptions {
  CSS: CSSPluginOptions;
  esbuild: esbuildPluginOptions;
  Use: UsePluginOptions;
}
