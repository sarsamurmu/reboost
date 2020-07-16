import { RawSourceMap, SourceMapConsumer } from 'source-map';
import chalk from 'chalk';
import * as babelTypes from '@babel/types';
import { parse } from '@babel/parser';
import { SourceLocation, codeFrameColumns } from '@babel/code-frame';
import traverse from '@babel/traverse';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin, PluginContext } from '../index';
import { getConfig } from '../shared';
import { bind, mergeSourceMaps } from '../utils';

let pluginsInitiated = false;
let resolveHooks: ReboostPlugin['resolve'][];
let loadHooks: ReboostPlugin['load'][];
let transformContentHooks: ReboostPlugin['transformContent'][];
let transformIntoJSHooks: ReboostPlugin['transformIntoJS'][];
let transformJSContentHooks: ReboostPlugin['transformJSContent'][];
let transformASTHooks: ReboostPlugin['transformAST'][];

const handleError = ({ message }: { message: string }) => {
  console.log(chalk.red(message));

  return { error: message };
}

export const getPluginHooks = () => {
  if (!pluginsInitiated) {
    const def = (a: any) => !!a;
    const plugins = getConfig().plugins.filter(def);
    const getHooks = <T extends keyof ReboostPlugin>(hookName: T): ReboostPlugin[T][] => {
      return plugins.map((plugin) => plugin[hookName]).filter(def);
    }

    resolveHooks = getHooks('resolve');
    loadHooks = getHooks('load');
    transformContentHooks = getHooks('transformContent');
    transformIntoJSHooks = getHooks('transformIntoJS');
    transformJSContentHooks = getHooks('transformJSContent');
    transformASTHooks = getHooks('transformAST');

    pluginsInitiated = true;
  }

  return {
    resolveHooks,
    loadHooks,
    transformContentHooks,
    transformIntoJSHooks,
    transformJSContentHooks,
    transformASTHooks
  }
}

export const process = async (
  filePath: string,
  pluginContext: PluginContext
): Promise<{
  ast?: babelTypes.Node;
  sourceMap?: RawSourceMap;
  error?: string;
}> => {
  // Load plugin hooks
  getPluginHooks();

  let code: string;
  let sourceMap: RawSourceMap;
  let ast: babelTypes.Node;
  let type: string;

  for (const hook of loadHooks) {
    const result = await bind(hook, pluginContext)(filePath);
    if (result) {
      ({ code } = result);
      ({ type } = result);
      if (result.map) sourceMap = result.map;
      break;
    }
  }

  const runTransformContentHooks = async (hooks: ReboostPlugin['transformContent'][]) => {
    for (const hook of hooks) {
      const result = await bind(hook, pluginContext)({ code, type, map: sourceMap }, filePath);
      if (result) {
        if (result instanceof Error) return handleError(result);

        ({ code } = result);
        if (result.map) {
          // Here source maps sources can be null, like when source map is generated using MagicString (npm package)
          result.map.sources = result.map.sources.map((sourcePath) => !sourcePath ? filePath : sourcePath);
          sourceMap = sourceMap ? await mergeSourceMaps(sourceMap, result.map) : result.map;
        }
        type = result.type || type;
      }
    }
  }

  runTransformContentHooks(transformContentHooks);

  for (const hook of transformIntoJSHooks) {
    const result = await bind(hook, pluginContext)({
      code,
      type,
      map: sourceMap
    }, filePath);

    if (result) {
      if (result instanceof Error) return handleError(result);

      ({ code } = result);
      sourceMap = result.inputMap;
      type = 'js';
      break;
    }
  }

  if (type !== 'js') {
    let message = `[reboost] ${filePath}: File with type "${type}" is not supported. `;
    message += 'You may need proper loader to transform this kind of files into JS.';
    return handleError({ message });
  }

  runTransformContentHooks(transformJSContentHooks);

  try {
    ast = parse(code, {
      sourceType: 'module'
    });
  } catch (e) {
    let message = '';
    let consoleMessage = '';
    const frameMessage = e.message.replace(/\s*\(.*\)$/, '');
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
      error: message
    }
  }

  for (const hook of transformASTHooks) {
    await bind(hook, pluginContext)(ast, { traverse, types: babelTypes }, filePath);
  }

  return {
    ast,
    sourceMap
  }
}

// export const finalProcess = async (
//   filePath: string,
//   pluginContext: PluginContext,
//   code: string,
//   sourceMap: RawSourceMap,
// ): Promise<{
//   code?: string;
//   sourceMap?: RawSourceMap;
//   error?: string;
// }> => {
//   getPluginHooks();

//   for (const hook of transformJSContentHooks) {
//     const result = await bind(hook, pluginContext)({ code, type: 'js', map: sourceMap }, filePath);
//     if (result) {
//       if (result instanceof Error) return handleError(result);

//       ({ code } = result);
//       if (result.map) {
//         // Here source maps sources can be null, like when source map is generated using MagicString (npm package)
//         result.map.sources = result.map.sources.map((sourcePath) => !sourcePath ? filePath : sourcePath);
//         sourceMap = sourceMap ? await mergeSourceMaps(sourceMap, result.map) : result.map;
//       }
//     }
//   }

//   return {
//     code,
//     sourceMap
//   }
// }
