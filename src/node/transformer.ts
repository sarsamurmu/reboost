import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate, { GeneratorOptions } from '@babel/generator';
import * as babelTypes from '@babel/types';
import { codeFrameColumns, SourceLocation } from '@babel/code-frame';
import anymatch from 'anymatch';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import chalk from 'chalk';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin, PluginContext } from './index';
import { getConfig, getAddress } from './shared';
import { mergeSourceMaps, bind } from './utils';
import { resolveModule } from './plugins/defaults/resolver';

const fixPath = (pathString: string) => pathString.replace(/\\/g, '/');

const getCompatibleSourceMap = (map: RawSourceMap) => {
  const config = getConfig();

  map.sourceRoot = 'reboost:///';

  map.sources = map.sources.map((sourcePath: string) => {
    if (path.isAbsolute(sourcePath)) return fixPath(path.relative(config.rootDir, sourcePath));
    return sourcePath;
  });

  map.sourcesContent = [];
  map.sources.forEach((sourcePath) => {
    const absolutePath = path.join(config.rootDir, sourcePath);
    if (fs.existsSync(absolutePath)) {
      map.sourcesContent.push(fs.readFileSync(absolutePath).toString());
    } else {
      console.log(chalk.red(`Unable to find file "${absolutePath}". Required for source map generation.`));
      map.sourcesContent.push(`Unable to find file in "${absolutePath}".`);
    }
  });

  map.file = undefined;

  return map;
}

const getPluginContext = (filePath: string, mergedDependencies: string[]): PluginContext => ({
  address: getAddress(),
  config: getConfig(),
  addDependency(dependency) {
    mergedDependencies.push(dependency);
  },
  getCompatibleSourceMap,
  MagicString,
  mergeSourceMaps,
  resolveModule
})

const handleError = ({ message }: Error, dependencies: string[]) => {
  console.log(chalk.red(message));

  return {
    code: `console.error(${JSON.stringify('[reboost] ' + message)})`,
    dependencies,
    error: true
  }
}

let pluginsInitiated = false;
let resolveHooks: ReboostPlugin['resolve'][];
let loadHooks: ReboostPlugin['load'][];
let transformContentHooks: ReboostPlugin['transformContent'][];
let transformIntoJSHooks: ReboostPlugin['transformIntoJS'][];
let transformASTHooks: ReboostPlugin['transformAST'][];

export const transformFile = async (filePath: string): Promise<{
  code: string;
  dependencies: string[];
  map?: string;
  imports?: string[];
  error?: boolean;
}> => {
  if (!pluginsInitiated) {
    const def = (a: any) => !!a;
    const plugins = getConfig().plugins.filter(def);

    resolveHooks = plugins.map((plugin) => plugin.resolve).filter(def);
    loadHooks = plugins.map((plugin) => plugin.load).filter(def);
    transformContentHooks = plugins.map((plugin) => plugin.transformContent).filter(def);
    transformIntoJSHooks = plugins.map((plugin) => plugin.transformIntoJS).filter(def);
    transformASTHooks = plugins.map((plugin) => plugin.transformAST).filter(def);
    
    pluginsInitiated = true;
  }

  let code: string;
  let sourceMap: RawSourceMap;
  let ast: babelTypes.Node;
  let type: string;
  let errorOccurred = false;
  const imports: string[] = [];
  const dependencies: string[] = [];
  const pluginContext = getPluginContext(filePath, dependencies);

  for (const hook of loadHooks) {
    let result = await bind(hook, pluginContext)(filePath);
    if (result) {
      ({ code } = result);
      ({ type } = result);
      if (result.map) sourceMap = result.map;
      break;
    }
  }

  for (const hook of transformContentHooks) {
    const result = await bind(hook, pluginContext)({ code, type, map: sourceMap }, filePath);
    if (result) {
      if (result instanceof Error) return handleError(result, dependencies);

      ({ code } = result);
      if (result.map) {
        // Here source maps sources can be null, like when source map is generated using MagicString (npm package)
        result.map.sources = result.map.sources.map((sourcePath) => !sourcePath ? filePath : sourcePath);
        sourceMap = sourceMap ? await mergeSourceMaps(sourceMap, result.map) : result.map;
      }
      if (result.type) ({ type } = result);
    }
  }

  for (const hook of transformIntoJSHooks) {
    const result = await bind(hook, pluginContext)({
      code,
      type,
      map: sourceMap
    }, filePath);

    if (result) {
      if (result instanceof Error) return handleError(result, dependencies);

      ({ code } = result);
      sourceMap = result.inputMap;
      type = 'js';
      break;
    }
  }

  if (type !== 'js') {
    console.log(chalk.red(`File with type "${type}" is not supported. You may need proper loader to transform this kind of files into JS.`));
  }

  try {
    ast = parse(code, {
      sourceType: 'module'
    });
  } catch (e) {
    let message = '';
    let consoleMessage = '';
    let frameMessage = e.message.replace(/\s*\(.*\)$/, '');
    let rawCode = code;
    let location: SourceLocation['start'] = e.loc;
    let unableToLocateFile = false;
    message += `Error while parsing "${filePath}"\n`;
    message += 'You may need proper loader to handle this kind of files.\n\n';

    consoleMessage += chalk.red(message);

    if (sourceMap) {
      const consumer = await new SourceMapConsumer(sourceMap);
      const originalLoc = consumer.originalPositionFor(e.loc);
      if (originalLoc.source) {
        const originalCode = consumer.sourceContentFor(originalLoc.source);
        if (originalCode) {
          rawCode = originalCode;
          location = originalLoc;
          location.column = location.column || 1;
        } else {
          const absPathToSource = path.join(getConfig().rootDir, originalLoc.source);
          if (fs.existsSync(absPathToSource)) {
            rawCode = fs.readFileSync(absPathToSource).toString();
            location = originalLoc;
            location.column = location.column || 1;
          } else {
            unableToLocateFile = true;
          }
        }
      }
    }

    if (unableToLocateFile) {
      let unableToLocateMsg = 'We are unable to locate the original file. ';
      unableToLocateMsg += 'This is not accurate, but it may help you at some point.\n\n';
      
      message += unableToLocateMsg + codeFrameColumns(code, { start: e.loc }, {
        message: frameMessage
      });

      consoleMessage += unableToLocateMsg + codeFrameColumns(code, { start: e.loc }, {
        highlightCode: true,
        message: frameMessage
      });
    } else {
      message += codeFrameColumns(rawCode, { start: location }, {
        message: frameMessage
      });

      consoleMessage += codeFrameColumns(rawCode, { start: location }, {
        highlightCode: true,
        message: frameMessage
      });
    }

    console.log(consoleMessage);

    return {
      code: `console.error('[reboost] ' + ${JSON.stringify(message)});`,
      dependencies,
      error: true
    }
  }

  for (const hook of transformASTHooks) await bind(hook, pluginContext)(ast, { traverse, types: babelTypes }, filePath);

  const resolvedPathMap = {} as Record<string, any>;
  const resolvePath = async (source: string, filePath: string) => {
    const keyStr = `${filePath}||${source}`;
    if (resolvedPathMap[keyStr]) return resolvedPathMap[keyStr];
    for (const hook of resolveHooks) {
      const resolvedPath = await hook(source, filePath);
      if (resolvedPath) {
        resolvedPathMap[keyStr] = resolvedPath;
        return resolvedPath
      }
    }
    console.log(chalk.red(`[reboost] Unable to resolve path "${source}" of "${filePath}"`));
    return null;
  }

  const resolveDeps = async (astPath: NodePath<babelTypes.ImportDeclaration> | NodePath<babelTypes.ExportDeclaration>) => {
    if ((astPath.node as any).source) {
      const source: string = (astPath.node as any).source.value;
      
      if (source === 'reboost/hmr') {
        (astPath.node as any).source.value = `/hmr?q=${encodeURI(filePath)}`;
      } else {
        let finalPath = null;
        let routed = false;
        if (source.startsWith('#/')) {
          finalPath = source.replace(/^#/, '');
          routed = true;
        } else {
          const resolvedPath = await resolvePath(source, filePath);
          if (resolvedPath) {
            if (resolvedPath.startsWith('#/')) {
              finalPath = resolvedPath.replace(/^#/, '');
              routed = true;
            } else {
              finalPath = resolvedPath;
              imports.push(resolvedPath);
            }
          } else {
            errorOccurred = true;
          }
        }

        (astPath.node as any).source.value = getAddress() + (routed
          ? encodeURI(finalPath)
          : finalPath
            ? `/transformed?q=${encodeURI(finalPath)}`
            : `/unresolved?import=${encodeURI(source)}`);
      }
    }
  }

  const promiseFunctions: (() => Promise<void>)[] = [];
  let astProgram: NodePath<babelTypes.Program>;

  traverse(ast, {
    Program(astPath) {
      astProgram = astPath;
    },
    ImportDeclaration(astPath) {
      promiseFunctions.push(async () => {
        await resolveDeps(astPath);
      });
      return false;
    },
    ExportDeclaration(astPath) {
      promiseFunctions.push(async () => {
        await resolveDeps(astPath);
      });
      return false;
    },
    CallExpression(astPath) {
      const t = babelTypes;
      if (t.isIdentifier(astPath.node.callee, { name: '__reboost_resolve' })) {
        promiseFunctions.push(async () => {
          astPath.replaceWith(
            t.stringLiteral(
              await resolvePath((astPath.node.arguments[0] as babelTypes.StringLiteral).value, filePath)
            )
          );
        });
      } else if (t.isImport(astPath.node.callee)) {
        // Rewrite dynamic imports
        const importDeclarations = astProgram.get('body').filter((p) => p.isImportDeclaration());
        let importerDeclaration = importDeclarations.find(
          (dec) => (dec as NodePath<babelTypes.ImportDeclaration>).node.source.value.includes('#/importer')
        ).node as babelTypes.ImportDeclaration;
        if (!importerDeclaration) {
          const identifier = astPath.scope.generateUidIdentifier('$importer');
          importerDeclaration = t.importDeclaration([
            t.importDefaultSpecifier(identifier)
          ], t.stringLiteral(`#/importer`));
          astProgram.node.body.unshift(importerDeclaration);
        }
        const importerIdentifierName = importerDeclaration.specifiers[0].local.name;
        astPath.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.identifier(importerIdentifierName),
              t.identifier('Dynamic')
            ),
            [
              t.stringLiteral((astPath.node.arguments[0] as babelTypes.StringLiteral).value),
              t.stringLiteral(filePath)
            ]
          )
        );
      }
    }
  });

  for (const execute of promiseFunctions) await execute();

  const sourceMapsConfig = getConfig().sourceMaps;
  const sourceMapsEnabled = !anymatch(sourceMapsConfig.exclude, filePath) && anymatch(sourceMapsConfig.include, filePath);
  const { debugMode } = getConfig();
  let generatorOptions: GeneratorOptions = {
    sourceMaps: true,
    sourceFileName: fixPath(path.relative(getConfig().rootDir, filePath)),
    sourceRoot: 'reboost:///',
    minified: !debugMode
  }

  const { code: generatedCode, map: generatedMap } = generate(ast, sourceMapsEnabled ? generatorOptions : undefined);
  let map;

  if (sourceMap && sourceMapsEnabled) {
    const merged = await mergeSourceMaps(sourceMap, generatedMap);
    map = getCompatibleSourceMap(merged);
  }

  return {
    code: generatedCode,
    map: map && JSON.stringify(map, null, getConfig().debugMode ? 2 : 0),
    imports,
    dependencies,
    error: errorOccurred
  }
}
