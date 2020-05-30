import esbuild, { Target } from 'esbuild';

import { ReboostPlugin, TransformedContent } from '../index';

type Loaders = 'js' | 'jsx' | 'ts' | 'tsx';

interface esbuildOptions {
  /**
   * Factory function to use with JSX
   * @default React.createElement
   */
  jsxFactory?: string;
  /**
   * JSX fragment
   * @default React.Fragment
   */
  jsxFragment?: string;
  /** ECMAScript version to target */
  target?: Target;
}

let esbuildService: esbuild.Service;

export const PluginName = 'core-esbuild-plugin';
export const esbuildPlugin = (options: esbuildOptions = {}): ReboostPlugin => {
  return {
    name: PluginName,
    async setup() {
      esbuildService = await esbuild.startService();
    },
    async transformIntoJS(data, filePath) {
      if (['ts', 'tsx', 'js', 'jsx'].includes(data.type)) {
        try {
          const { js, jsSourceMap } = await esbuildService.transform(data.code, {
            sourcemap: true,
            loader: data.type.includes('x') ? data.type : data.type + 'x' as any,
            jsxFactory: options.jsxFactory,
            jsxFragment: options.jsxFragment,
            target: options.target
          });

          const generatedMap = JSON.parse(jsSourceMap);
          generatedMap.sources = [filePath];

          return {
            code: js,
            inputMap: data.map ? await this.mergeSourceMaps(data.map, generatedMap) : generatedMap
          }
        } catch (e) {
          console.log('esbuild error', e);
        }
      }

      return null;
    }
  }
}
