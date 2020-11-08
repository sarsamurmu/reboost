import fs from 'fs';
import path from 'path';

const reboostPackageVersions = JSON.parse(
  fs.readFileSync(path.join(__dirname, './package-versions.json')).toString()
);

export const versions: Record<string, string> = {
  'reboost': reboostPackageVersions['core'],
  
  'lit-element': '2.4.0',

  'electron': '10.1.5',

  'preact': '10.5.5',

  'svelte': '3.29.4',
  'reboost-plugin-svelte': reboostPackageVersions['plugin-svelte'],

  'react': '17.0.1',
  'react-dom': '17.0.1',
  '@types/react': '16.9.56',
  '@types/react-dom': '16.9.9',
  'reboost-plugin-react-refresh': reboostPackageVersions['plugin-react-refresh'],

  'vue': '3.0.0',
  'reboost-plugin-vue': reboostPackageVersions['plugin-vue'],
};

Object.keys(versions).forEach((key) => versions[key] = '^' + versions[key]);
