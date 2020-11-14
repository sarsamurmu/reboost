import fs from 'fs';
import path from 'path';

const reboostPackageVersions: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, './package-versions.json')).toString()
);

export const versions: Record<string, string> = {
  'reboost': reboostPackageVersions['core'],
  
  'electron': '10.1.5',
  
  'lit-element': '2.4.0',

  'malinajs': '0.6.4',
  'reboost-plugin-malinajs': reboostPackageVersions['plugin-malinajs'],

  'preact': '10.5.7',

  'react': '17.0.1',
  'react-dom': '17.0.1',
  '@types/react': '16.9.56',
  '@types/react-dom': '16.9.9',
  'reboost-plugin-react-refresh': reboostPackageVersions['plugin-react-refresh'],

  'solid-js': '0.22.0',
  '@babel/core': '7.12.3',
  'babel-preset-solid': '0.20.1',
  'reboost-plugin-babel': reboostPackageVersions['plugin-babel'],

  'svelte': '3.29.7',
  'reboost-plugin-svelte': reboostPackageVersions['plugin-svelte'],

  'vue': '3.0.0',
  'reboost-plugin-vue': reboostPackageVersions['plugin-vue'],
};

Object.keys(versions).forEach((key) => versions[key] = '^' + versions[key]);
