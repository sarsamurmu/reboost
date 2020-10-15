import { RawSourceMap, SourceMapConsumer } from 'source-map';
import chalk from 'chalk';
import * as babelTypes from '@babel/types';
import { parse } from '@babel/parser';
import { SourceLocation, codeFrameColumns } from '@babel/code-frame';
import traverse from '@babel/traverse';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin, PluginContext, ReboostInstance } from '../index';
import { bind, mergeSourceMaps } from '../utils';

const pluginHooksMap = new Map<ReboostInstance, {
  stopHooks: ReboostPlugin['stop'][];
  resolveHooks: ReboostPlugin['resolve'][];
  loadHooks: ReboostPlugin['load'][];
  transformContentHooks: ReboostPlugin['transformContent'][];
  transformIntoJSHooks: ReboostPlugin['transformIntoJS'][];
  transformJSContentHooks: ReboostPlugin['transformJSContent'][];
  transformASTHooks: ReboostPlugin['transformAST'][];
}>();
export const getPluginHooks = (instance: ReboostInstance) => {
  if (!pluginHooksMap.has(instance)) {
    const getHooks = <T extends keyof ReboostPlugin>(hookName: T): ReboostPlugin[T][] => {
      return instance.plugins.map((plugin) => plugin[hookName]).filter((a) => !!a);
    }

    pluginHooksMap.set(instance, {
      stopHooks: getHooks('stop'),
      resolveHooks: getHooks('resolve'),
      loadHooks: getHooks('load'),
      transformContentHooks: getHooks('transformContent'),
      transformIntoJSHooks: getHooks('transformIntoJS'),
      transformJSContentHooks: getHooks('transformJSContent'),
      transformASTHooks: getHooks('transformAST')
    });

    instance.onStop('Removes plugins associated with the instance', () => pluginHooksMap.delete(instance));
  }

  return pluginHooksMap.get(instance);
}

export const createProcessor = (instance: ReboostInstance) => {
  const handleError = ({ message }: { message: string }) => {
    instance.log('info', chalk.red(message));
    return { error: message };
  }

  const process = async (
    filePath: string,
    pluginContext: PluginContext
  ): Promise<{
    ast?: babelTypes.Node;
    sourceMap?: RawSourceMap;
    error?: string;
  }> => {
    const pluginHooks = getPluginHooks(instance);

    let code: string;
    let sourceMap: RawSourceMap;
    let ast: babelTypes.Node;
    let type: string;

    for (const hook of pluginHooks.loadHooks) {
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
          if (result.type) type = result.type;
        }
      }
    }

    let transformContentError: { error: string };
    transformContentError = await runTransformContentHooks(pluginHooks.transformContentHooks);
    if (transformContentError) return transformContentError;

    if (type !== 'js') {
      for (const hook of pluginHooks.transformIntoJSHooks) {
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
    }

    if (!['js', 'mjs', 'es6', 'es', 'cjs'].includes(type)) {
      let message = `${filePath}: File with type "${type}" is not supported. `;
      message += 'You may need proper loader to transform this kind of files into JS.';
      return handleError({ message });
    }

    transformContentError = await runTransformContentHooks(pluginHooks.transformJSContentHooks);
    if (transformContentError) return transformContentError;

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
            const absPathToSource = path.join(instance.config.rootDir, originalLoc.source);
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

      instance.log('info', consoleMessage);

      return {
        error: message
      }
    }

    for (const hook of pluginHooks.transformASTHooks) {
      await bind(hook, pluginContext)(ast, { traverse, types: babelTypes }, filePath);
    }

    return {
      ast,
      sourceMap
    }
  }

  return { process }
}
