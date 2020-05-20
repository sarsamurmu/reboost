import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as babelTypes from '@babel/types';
import anymatch from 'anymatch';
import { RawSourceMap } from 'source-map';
import chalk from 'chalk';

import path from 'path';

import { ReboostPlugin } from './index';
import { getConfig } from './shared';
import { mergeSourceMaps } from './utils';

let pluginsInitiated = false;
let resolveHooks: ReboostPlugin['resolve'][];
let loadHooks: ReboostPlugin['load'][];
let transformContentHooks: ReboostPlugin['transformContent'][];
let transformASTHooks: ReboostPlugin['transformAST'][];

export const transformFile = async (filePath: string) => {
  if (!pluginsInitiated) {
    const def = (a: any) => !!a;
    const plugins = getConfig().plugins.filter(def);
    resolveHooks = plugins.map((plugin) => plugin.resolve).filter(def);
    loadHooks = plugins.map((plugin) => plugin.load).filter(def);
    transformContentHooks = plugins.map((plugin) => plugin.transformContent).filter(def);
    transformASTHooks = plugins.map((plugin) => plugin.transformAST).filter(def);
    
    pluginsInitiated = true;
  }

  let code: string;
  let originalCode: string;
  let sourceMap: RawSourceMap;
  let ast: babelTypes.Node;
  let dependencies: string[] = [];
  let hasUnresolvedDeps = false;

  for (const hook of loadHooks) {
    let result = await hook(filePath);
    if (result) {
      code = result.code;
      originalCode = result.original || code;
      if (result.map) sourceMap = JSON.parse(result.map);
      break;
    }
  }

  for (const hook of transformContentHooks) {
    const transformed = await hook(code, filePath);
    if (transformed) {
      code = transformed.code;
      sourceMap = sourceMap ? await mergeSourceMaps(sourceMap, JSON.parse(transformed.map)) : JSON.parse(transformed.map);
    }
  }

  try {
    ast = parse(code, {
      sourceType: 'module'
    });
  } catch (e) {
    console.log(`Error while parsing "${filePath}"`);
    console.log(e);
  }

  for (const hook of transformASTHooks) await hook(ast, { traverse, types: babelTypes }, filePath);

  const resolveDeps = async (astPath: NodePath<babelTypes.ImportDeclaration> | NodePath<babelTypes.ExportDeclaration>) => {
    if ((astPath.node as any).source) {
      let finalPath = null;
      let routed = false;
      const source: string = (astPath.node as any).source.value;
      if (source.startsWith('#/')) {
        finalPath = source.replace(/^#/, '');
        routed = true;
      } else {
        for (const hook of resolveHooks) {
          const resolvedPath = await hook(source, filePath);
          if (resolvedPath) {
            if (resolvedPath.startsWith('#/')) {
              finalPath = resolvedPath.replace(/^#/, '');
              routed = true;
            } else {
              finalPath = resolvedPath;
              dependencies.push(resolvedPath);
            }
            break;
          } else {
            hasUnresolvedDeps = true;
            console.log(chalk.red(`[reboost] Unable to resolve import "${source}" of "${filePath}"`));
          }
        }
      }
      (astPath.node as any).source.value = routed
          ? encodeURI(finalPath)
          : finalPath
            ? `/transformed?q=${encodeURI(finalPath)}`
            : `/unresolved?import=${encodeURI(source)}&importer=${encodeURI(filePath)}`;
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

  for (const astPath of astPathsToResolve) await resolveDeps(astPath);

  let generatorOptions = {
    sourceMaps: true,
    sourceFileName: path.basename(filePath),
    sourceRoot: 'reboost:///' + path.relative(getConfig().rootDir, path.dirname(filePath)).replace(/\\/g, '/')
  };
  const sourceMapsConfig = getConfig().sourceMaps;
  const sourceMapsEnabled = !anymatch(sourceMapsConfig.exclude, filePath) && anymatch(sourceMapsConfig.include, filePath);

  const { code: generatedCode, map: generatedMap } = generate(ast, sourceMapsEnabled ? generatorOptions : undefined);
  let map;

  if (sourceMapsEnabled) {
    if (sourceMap) {
      map = await mergeSourceMaps(sourceMap, generatedMap);
      map.sources = [generatorOptions.sourceFileName];
      map.sourceRoot = generatorOptions.sourceRoot;
    } else {
      map = generatedMap;
    }
    map.sourcesContent = [originalCode];
  }

  return {
    code: generatedCode,
    map: map && JSON.stringify(map, null, getConfig().debugMode ? 2 : 0),
    dependencies,
    hasUnresolvedDeps
  }
}
