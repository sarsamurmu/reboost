import chalk from 'chalk';

const movedToDifferentPackage = (name: string, pluginPackage: string) => {
  console.log(chalk.cyan(`
${name} has now it's own package ("@reboost/plugin-${pluginPackage}"),
so it is no longer included with this package.

To use this plugin plugin, first install the plugin package
------------------
npm i -D @reboost/plugin-${pluginPackage}
------------------
Then in "reboost.js", instead of
------------------
const { start, ${name} } = require('reboost');
------------------
use
------------------
const { start } = require('reboost');
const ${name} = require('@reboost/plugin-${pluginPackage}');
------------------
  `));
  return {};
}

const movedToBuiltIn = (name: string) => {
  console.log(chalk.cyan(`
${name} is now moved to \`require('reboost').builtInPlugins\`.
So now you have to use this syntax to import the plugin
------------------
const { start, builtInPlugins: { ${name} } } = require('reboost');
------------------
  `));
  return {};
}

// TODO: Remove these on v1.0
export const BabelPlugin = (() => movedToDifferentPackage('BabelPlugin', 'babel')) as never;
export const PostCSSPlugin = (() => movedToDifferentPackage('PostCSSPlugin', 'postcss')) as never;
export const SassPlugin = (() => movedToDifferentPackage('SassPlugin', 'sass')) as never;
export const SveltePlugin = (() => movedToDifferentPackage('SveltePlugin', 'svelte')) as never;

export const CSSPlugin = (() => movedToBuiltIn('CSSPlugin')) as never;
export const esbuildPlugin = (() => movedToBuiltIn('esbuildPlugin')) as never;
export const FilePlugin = (() => movedToBuiltIn('FilePlugin')) as never;
export const ReplacePlugin = (() => movedToBuiltIn('ReplacePlugin')) as never;
export const UsePlugin = (() => movedToBuiltIn('UsePlugin')) as never;
