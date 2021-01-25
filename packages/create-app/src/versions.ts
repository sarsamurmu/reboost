import fs from 'fs';
import path from 'path';

const reboostPackageVersions: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, './package-versions.json'), 'utf8')
);

export const versions: Record<string, string> = {
  'reboost': reboostPackageVersions['core'],
  
  'electron': '11.1.1',
  
  'lit-element': '2.4.0',

  'malinajs': '0.6.10',
  'reboost-plugin-malinajs': reboostPackageVersions['plugin-malinajs'],

  'preact': '10.5.9',
  'reboost-plugin-prefresh': reboostPackageVersions['plugin-prefresh'],

  'react': '17.0.1',
  'react-dom': '17.0.1',
  '@types/react': '17.0.0',
  '@types/react-dom': '17.0.0',
  'reboost-plugin-react-refresh': reboostPackageVersions['plugin-react-refresh'],

  'solid-js': '0.23.8',
  '@babel/core': '7.12.10',
  'babel-preset-solid': '0.23.8',
  'reboost-plugin-babel': reboostPackageVersions['plugin-babel'],

  'svelte': '3.31.2',
  'reboost-plugin-svelte': reboostPackageVersions['plugin-svelte'],

  'vue': '3.0.0',
  'reboost-plugin-vue': reboostPackageVersions['plugin-vue'],
};

Object.keys(versions).forEach((key) => versions[key] = '^' + versions[key]);
