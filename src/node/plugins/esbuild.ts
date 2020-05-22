import esbuild, { Target } from 'esbuild';
import { parse } from '@babel/parser';

import fs from 'fs';

import { ReboostPlugin, TransformedContent } from '../index';

interface esbuildOptions {
  /** File types which esbuild should handle */
  loaders?: ('js' | 'jsx' | 'ts' | 'tsx')[];
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
const esbuildPlugin = (options: esbuildOptions): ReboostPlugin => {
  const matcher = new RegExp(`(${options.loaders.map((ext) => `\\.${ext}`).join('|')})$`);
  return {
    async setup() {
      esbuildService = await esbuild.startService();
    },
    async transformContent(code, filePath) {
      const match = filePath.match(matcher);
      if (match) {
        try {
          const { js, jsSourceMap } = await esbuildService.transform(code, {
            sourcemap: true,
            loader: match[0].substring(1) as any,
            jsxFactory: options.jsxFactory,
            jsxFragment: options.jsxFragment,
            target: options.target
          });

          return {
            code: js,
            map: jsSourceMap
          } as TransformedContent;
        } catch (e) {
          console.log('esbuild error', e);
        }
      }
      return null;
    }
  }
}

export { esbuildPlugin as esbuild }
