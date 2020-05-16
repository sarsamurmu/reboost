import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as babelTypes from '@babel/types';
import anymatch from 'anymatch';
import { RawSourceMap } from 'source-map';
import chalk from 'chalk';

import path from 'path';

import { ReboostPlugin } from './index';
import { getConfig, getAddress } from './shared';
import { defaultPlugin } from './plugins/default';
import { mergeSourceMaps } from './utils';

let pluginsInitiated = false;
let resolveHooks: ReboostPlugin['resolve'][];
let loadHooks: ReboostPlugin['load'][];
let transformHooks: ReboostPlugin['transform'][];

export const transformFile = async (filePath: string) => {
  if (!pluginsInitiated) {
    getConfig().plugins.push(defaultPlugin);
    const def = (a: any) => !!a;
    const plugins = getConfig().plugins.filter(def);
    resolveHooks = plugins.map((plugin) => plugin.resolve).filter(def);
    loadHooks = plugins.map((plugin) => plugin.load).filter(def);
    transformHooks = plugins.map((plugin) => plugin.transform).filter(def);

    const promises = [];
    for (const { start } of plugins) {
      if (typeof start === 'function') promises.push(start(getConfig()));
    }
    await Promise.all(promises);
    
    pluginsInitiated = true;
  }

  let ast: babelTypes.Node;
  let inputSourceMap: RawSourceMap;
  let originalCode: string;
  let dependencies: string[] = [];
  let hasUnresolvedDeps = false;

  for (const hook of loadHooks) {
    let result = await hook(filePath);
    if (result) {
      ast = result.ast;
      originalCode = result.code;
      if (result.map) {
        inputSourceMap = JSON.parse(result.map);
      }
      break;
    }
  }
  if (ast) {
    for (const hook of transformHooks) {
      const transformed = await hook({ ast }, { traverse, types: babelTypes }, filePath);
      if (transformed) ast = transformed.ast;
    }

    const resolveDeps = async (astPath: NodePath<babelTypes.ImportDeclaration> | NodePath<babelTypes.ExportDeclaration>) => {
      if ((astPath.node as any).source) {
        let finalPath = null;
        const source = (astPath.node as any).source.value;
        for (const hook of resolveHooks) {
          const resolvedPath = await hook(source, filePath);
          if (resolvedPath) {
            finalPath = resolvedPath;
            dependencies.push(resolvedPath);
            break;
          } else {
            hasUnresolvedDeps = true;
            console.log(chalk.red(`[reboost] Unable to resolve import "${source}" of "${filePath}"`));
          }
        }
        (astPath.node as any).source.value = finalPath
                                              ? `${getAddress()}/transformed?q=${encodeURI(finalPath)}`
                                              : `${getAddress()}/unresolved?import=${encodeURI(source)}&importer=${encodeURI(filePath)}`;
      }
    }

    const astPathsToResolve: Parameters<typeof resolveDeps>[0][] = [];

    traverse(ast, {
      ImportDeclaration(astPath) {
        astPathsToResolve.push(astPath);
        return false;
      },
      ExportDeclaration(astPath) {
        astPathsToResolve.push(astPath);
        return false;
      }
    });

    for (const astPath of astPathsToResolve) {
      await resolveDeps(astPath);
    }
  }

  let generatorOptions = {
    sourceMaps: true,
    sourceFileName: path.basename(filePath),
    sourceRoot: 'reboost:///' + path.relative(getConfig().rootDir, path.dirname(filePath)).replace(/\\/g, '/')
  };
  const sourceMapsConfig = getConfig().sourceMaps;
  const sourceMapsEnabled = !anymatch(sourceMapsConfig.exclude, filePath) && anymatch(sourceMapsConfig.include, filePath);

  const { code, map: generatedMap } = generate(ast, sourceMapsEnabled ? generatorOptions : undefined);
  let map;

  if (sourceMapsEnabled) {
    if (inputSourceMap) {
      map = await mergeSourceMaps(inputSourceMap, generatedMap);
      map.sources = [generatorOptions.sourceFileName];
      map.sourceRoot = generatorOptions.sourceRoot;
    } else {
      map = generatedMap;
    }
    map.sourcesContent = [originalCode];
  }

  return {
    code,
    map: map && JSON.stringify(map, null, getConfig().debugMode ? 2 : 0),
    dependencies,
    hasUnresolvedDeps
  }
}
