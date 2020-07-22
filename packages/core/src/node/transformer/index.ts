import generate, { GeneratorOptions } from '@babel/generator';
import anymatch from 'anymatch';
import { RawSourceMap } from 'source-map';
import chalk from 'chalk';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { PluginContext } from '../index';
import { getConfig, getAddress } from '../shared';
import { mergeSourceMaps, toPosix } from '../utils';
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
      console.log(chalk.red(`Unable to find file "${toPosix(absolutePath)}". Required for source map generation.`));
      map.sourcesContent.push(`Unable to find file in "${toPosix(absolutePath)}".`);
    }
  });

  map.file = undefined;

  return map;
}

const getPluginContext = (filePath: string, mergedDependencies: string[]): PluginContext => ({
  address: getAddress(),
  config: getConfig(),
  addDependency(dependency) {
    mergedDependencies.push(toPosix(dependency));
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

export const transformFile = async (filePath: string): Promise<{
  code: string;
  dependencies: string[];
  map?: string;
  imports?: string[];
  error?: boolean;
}> => {
  let errorOccurred = false;
  const imports: string[] = [];
  const dependencies: string[] = [];
  const pluginContext = getPluginContext(filePath, dependencies);

  const getErrorObj = (msg: string) => ({
    code: `console.error('[reboost] ' + ${JSON.stringify(msg)})`,
    error: true,
    dependencies
  });

  const processed = await process(filePath, pluginContext);

  if (processed.error) return getErrorObj(processed.error);

  const { ast, sourceMap } = processed;

  errorOccurred = await resolveImports(ast, filePath, imports);

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
    imports,
    dependencies,
    error: errorOccurred
  }
}
