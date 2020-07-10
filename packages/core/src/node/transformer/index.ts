import generate, { GeneratorOptions } from '@babel/generator';
import anymatch from 'anymatch';
import { RawSourceMap } from 'source-map';
import chalk from 'chalk';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { PluginContext } from '../index';
import { getConfig, getAddress } from '../shared';
import { mergeSourceMaps } from '../utils';
import { resolve } from '../core-plugins/resolver';
import { process } from './processor';
import { resolveImports } from './import-resolver';

const fixPath = (pathString: string) => pathString.replace(/\\/g, '/');

const getCompatibleSourceMap = (map: RawSourceMap) => {
  const config = getConfig();

  map.sourceRoot = 'reboost:///';

  map.sources = map.sources.map((sourcePath: string) => {
    if (path.isAbsolute(sourcePath)) return fixPath(path.relative(config.rootDir, sourcePath));
    return fixPath(sourcePath);
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
})

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

  const processed = await process(
    filePath,
    getPluginContext(filePath, dependencies)
  );

  if (processed.error) {
    return {
      code: `console.error('[reboost] ' + ${JSON.stringify(processed.error)})`,
      error: true,
      dependencies
    }
  }

  const { ast, sourceMap } = processed;

  errorOccurred = await resolveImports(ast, filePath, imports);

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
