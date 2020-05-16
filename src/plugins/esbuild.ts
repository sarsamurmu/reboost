import esbuild, { Target } from 'esbuild';
import { parse } from '@babel/parser';

import fs from 'fs';

import { ReboostPlugin } from '../index';

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
    async start() {
      esbuildService = await esbuild.startService();
    },
    async load(filePath) {
      const match = filePath.match(matcher);
      if (match) {
        const code = fs.readFileSync(filePath).toString();
        const { js, jsSourceMap } = await esbuildService.transform(code, {
          sourcemap: true,
          loader: match[0].substring(1) as any,
          jsxFactory: options.jsxFactory,
          jsxFragment: options.jsxFragment,
          target: options.target
        });
        return {
          code,
          ast: parse(js, {
            sourceType: 'module',
          }),
          map: jsSourceMap
        }
      }
      return null;
    }
  }
}

export { esbuildPlugin as esbuild }
