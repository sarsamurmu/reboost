import generate, { GeneratorOptions } from '@babel/generator';
import anymatch from 'anymatch';
import { RawSourceMap } from 'source-map';
import chalk from 'chalk';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { PluginContext } from '../index';
import { getConfig } from '../shared';
import { mergeSourceMaps, toPosix, tLog } from '../utils';
import { resolve } from '../core-plugins/resolver';
import { process } from './processor';
import { resolveImports } from './import-resolver';

const getCompatibleSourceMap = (map: RawSourceMap) => {
  const config = getConfig();

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
      tLog('info', chalk.red(`Unable to find file "${absolutePath}". Required for source map generation.`));
      map.sourcesContent.push(`Unable to find file in "${absolutePath}".`);
    }
  });

  map.file = undefined;

  return map;
}

const getPluginContext = (filePath: string, mergedDependencies: string[]): PluginContext => ({
  config: getConfig(),
  addDependency(dependency) {
    mergedDependencies.push(path.normalize(dependency));
  },
  chalk,
  getCompatibleSourceMap,
  getSourceMapComment(map) {
    let comment = '/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
    comment += Buffer.from(JSON.stringify(map)).toString('base64');
    comment += ' */';
    return comment;
  },
  MagicString,
  mergeSourceMaps,
  resolve
});

const getErrorObj = (msg: string, dependencies: string[]) => ({
  code: `console.error('[reboost] ' + ${JSON.stringify(msg)})`,
  error: true,
  dependencies
});

export const transformFile = async (filePath: string): Promise<{
  code: string;
  dependencies: string[];
  map?: string;
  error?: boolean;
}> => {
  let errorOccurred = false;
  const dependencies: string[] = [];
  const pluginContext = getPluginContext(filePath, dependencies);

  const processed = await process(filePath, pluginContext);

  if (processed.error) return getErrorObj(processed.error, dependencies);

  const { ast, sourceMap } = processed;

  errorOccurred = await resolveImports(ast, filePath);

  const sourceMapsConfig = getConfig().sourceMaps;
  const sourceMapsEnabled = !anymatch(sourceMapsConfig.exclude, filePath) && anymatch(sourceMapsConfig.include, filePath);
  const { debugMode } = getConfig();
  const generatorOptions: GeneratorOptions = {
    sourceMaps: true,
    sourceFileName: toPosix(path.relative(getConfig().rootDir, filePath)),
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
    dependencies,
    error: errorOccurred
  }
}
