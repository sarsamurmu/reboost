import escodegen from 'escodegen';
import anymatch from 'anymatch';
import { RawSourceMap } from 'source-map';
import chalk from 'chalk';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { PluginContext, ReboostInstance } from '../index';
import { mergeSourceMaps, toPosix } from '../utils';
import { resolve } from '../core-plugins/resolver';
import { createProcessor } from './processor';
import { resolveImports } from './import-resolver';

const getCompatibleSourceMap = (instance: ReboostInstance, map: RawSourceMap) => {
  const { config } = instance;
  map.sourceRoot = 'reboost:///';

  map.sources = map.sources.map((sourcePath: string) => {
    if (path.isAbsolute(sourcePath)) return toPosix(path.relative(config.rootDir, sourcePath));
    return toPosix(sourcePath);
  });

  map.sourcesContent = [];
  map.sources.forEach((sourcePath) => {
    const absolutePath = path.join(config.rootDir, sourcePath);
    if (fs.existsSync(absolutePath)) {
      map.sourcesContent.push(fs.readFileSync(absolutePath).toString());
    } else {
      instance.log('info', chalk.red(`Unable to find file "${absolutePath}". Required for source map generation.`));
      map.sourcesContent.push(`Unable to find file in "${absolutePath}".`);
    }
  });

  map.file = undefined;

  return map;
}

const getPluginContext = (
  instance: ReboostInstance,
  filePath: string,
  mergedDependencies: string[]
): PluginContext => ({
  chalk,
  config: instance.config,
  meta: {},
  emitWarning(message, color = true) {
    const line = '-'.repeat(process.stdout.columns);
    message = line + '\n' + message + '\n' + line;
    if (color) message = chalk.yellow(message);
    console.log(message);
  },
  addDependency(dependency) {
    mergedDependencies.push(path.normalize(dependency));
  },
  getCompatibleSourceMap: (map) => getCompatibleSourceMap(instance, map),
  getSourceMapComment(map) {
    let comment = '/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
    comment += Buffer.from(JSON.stringify(map)).toString('base64');
    comment += ' */';
    return comment;
  },
  MagicString,
  mergeSourceMaps,
  resolve: (...args) => resolve(instance, ...args),
  rootRelative: (filePath) => path.relative(instance.config.rootDir, filePath)
});

const getErrorObj = (msg: string, dependencies: string[]) => ({
  code: `console.error('[reboost] ' + ${JSON.stringify(msg)})`,
  error: true,
  dependencies
});

export const createTransformer = (instance: ReboostInstance) => {
  const { debugMode } = instance.config;
  const baseGeneratorOptions: escodegen.GenerateOptions = {
    format: debugMode ? {
      indent: { style: '  ' },
    } : (escodegen as any).FORMAT_MINIFY,
    comment: debugMode,
  }
  const sourceMapsConfig = instance.config.sourceMaps;

  const processor = createProcessor(instance);
  const transformFile = async (filePath: string): Promise<{
    code: string;
    dependencies: string[];
    map?: string;
    error?: boolean;
  }> => {
    let errorOccurred = false;
    const dependencies: string[] = [];
    const pluginContext = getPluginContext(instance, filePath, dependencies);

    const processed = await processor.process(filePath, pluginContext);

    if (processed.error) return getErrorObj(processed.error, dependencies);

    const { programPath, sourceMap } = processed;

    errorOccurred = await resolveImports(instance, programPath, filePath);

    const sourceMapsEnabled = !anymatch(sourceMapsConfig.exclude, filePath) && anymatch(sourceMapsConfig.include, filePath);

    let generatedCode, map;

    if (sourceMap && sourceMapsEnabled) {
      const generated: any = escodegen.generate(programPath.node, Object.assign({}, baseGeneratorOptions, {
        sourceMap: toPosix(path.relative(instance.config.rootDir, filePath)),
        sourceMapRoot: 'reboost:///',
        sourceMapWithCode: true,
      }));
      generatedCode = generated.code;
      const merged = await mergeSourceMaps(sourceMap, generated.map.toString());
      map = getCompatibleSourceMap(instance, merged);
    } else {
      generatedCode = escodegen.generate(programPath.node, baseGeneratorOptions);
    }

    return {
      code: generatedCode,
      map: map && JSON.stringify(map, null, instance.config.debugMode ? 2 : 0),
      dependencies,
      error: errorOccurred
    }
  }

  return { transformFile }
}
