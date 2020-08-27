import chalk from 'chalk';

import { JSONPlugin } from './json';
import { LoaderPlugin } from './loader';
import { ResolverPlugin } from './resolver';
import { NodeEnvPlugin } from './node-env';
import { CommonJSMode1Plugin } from './commonjs-mode-1/';
import { CommonJSMode2Plugin } from './commonjs-mode-2/';

import { ReboostPlugin } from '../index';
import { getConfig } from '../shared';
import { tLog } from '../utils';

export const CorePlugins = (): ReboostPlugin[] => {
  const plugins = [
    JSONPlugin(),
    LoaderPlugin(),
    ResolverPlugin(),
    NodeEnvPlugin()
  ];

  // TODO: Remove in next release
  tLog('info', chalk.cyan(
    'CommonJS interoperability has changed in the last release.\n' +
    'If your all files are CommonJS modules, your code may not work in this release.\n' +
    'Please see the configuration docs to fix this issue - ' +
    'https://github.com/sarsamurmu/reboost/blob/primary/docs/configurations.md#commonjsinterop.\n' +
    'If your all files are ES modules then just ignore this message.\n' +
    'Have a great day :)\n'
  ));

  if (getConfig().commonJSInterop.mode > 0) {
    plugins.push(
      getConfig().commonJSInterop.mode === 1
        ? CommonJSMode1Plugin()
        : CommonJSMode2Plugin()
    )
  }

  return plugins;
}
