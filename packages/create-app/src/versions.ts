import fs from 'fs';
import path from 'path';

const reboostPackageVersions: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, './package-versions.json'), 'utf8')
);

export const versions: Record<string, string> = {
  'reboost': reboostPackageVersions['core'],
  
  'electron': '11.1.1',
  
  'lit': '2.0.0',

  'malinajs': '0.6.43',
  'reboost-plugin-malinajs': reboostPackageVersions['plugin-malinajs'],

  'preact': '10.5.14',
  'reboost-plugin-prefresh': reboostPackageVersions['plugin-prefresh'],

  'react': '17.0.2',
  'react-dom': '17.0.2',
  '@types/react': '17.0.24',
  '@types/react-dom': '17.0.9',
  'reboost-plugin-react-refresh': reboostPackageVersions['plugin-react-refresh'],

  'solid-js': '1.1.5',
  '@babel/core': '7.15.5',
  'babel-preset-solid': '1.1.5',
  'reboost-plugin-babel': reboostPackageVersions['plugin-babel'],

  'svelte': '3.43.0',
  'reboost-plugin-svelte': reboostPackageVersions['plugin-svelte'],

  'vue': '3.0.0',
  'reboost-plugin-vue': reboostPackageVersions['plugin-vue'],
};

Object.keys(versions).forEach((key) => versions[key] = '^' + versions[key]);
