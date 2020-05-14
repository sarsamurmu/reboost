import esbuild, { Target } from 'esbuild';
import { parse } from '@babel/parser';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from './index';
import { getConfig } from './shared';
import { isDir } from './utils';

export const resolvePath = (basePath: string, pathToResolve: string) => {
  const resolveExt = (fPath: string) => {
    for (const ext of getConfig().resolve.extensions) {
      if (fs.existsSync(fPath + ext)) return ext;
    }
    return null;
  }

  const baseResolve = (fPath: string) => {
    if (fs.existsSync(fPath) && isDir(fPath)) {
      for (const mainFile of getConfig().resolve.mainFiles) {
        const dirPath = path.join(fPath, mainFile);
        const ext = resolveExt(dirPath);
        if (ext) return dirPath + ext;
      }
    } else {
      const ext = resolveExt(fPath);
      if (ext) return fPath + ext;
    }
    if (fPath.match(/(\..*|\..*)$/)) return fPath;
    return null;
  }
  if (pathToResolve.startsWith('.')) {
    return baseResolve(path.resolve(path.dirname(basePath), pathToResolve));
  } else {
    const split = pathToResolve.split('/').filter((s) => s !== '');
    const config = getConfig();
    if (split[0] in config.resolve.alias) {
      return baseResolve(path.resolve(config.rootDir, config.resolve.alias[split[0]], pathToResolve));
    } else {
      // Check in resolve.modules directories
      const { rootDir, resolve } = getConfig();
      for (const modulesDirName of resolve.modules) {
        const modulesDirPath = path.join(rootDir, modulesDirName);
        if (fs.existsSync(modulesDirPath)) {
          const moduleName = split.shift();
          const moduleDirPath = path.join(modulesDirPath, moduleName);
          if (split.length !== 0) {
            // Using subdirectories
            return baseResolve(path.join(moduleDirPath, ...split));
          } else {
            // Get from package.json
            const pkgJSONPath = path.join(moduleDirPath, 'package.json');
            if (fs.existsSync(pkgJSONPath)) {
              const pkgJSON = JSON.parse(fs.readFileSync(pkgJSONPath).toString());
              if (pkgJSON.module) return path.join(moduleDirPath, pkgJSON.module);
            }
          }
        }
      }
    }
  }

  return null;
}

export const defaultPlugin: ReboostPlugin = {
  load(importPath) {
    const code = fs.readFileSync(importPath).toString();
    return {
      code,
      ast: parse(code, {
        sourceType: 'module'
      })
    }
  },
  resolve(source, importer) {
    return resolvePath(importer, source);
  }
}

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
    async load(importPath) {
      const match = importPath.match(matcher);
      if (match) {
        const code = fs.readFileSync(importPath).toString();
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
