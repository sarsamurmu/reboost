import fs from 'fs';
import path from 'path';

const reboostPackageVersions = JSON.parse(
  fs.readFileSync(path.join(__dirname, './package-versions.json')).toString()
);

export const versions = {
  reboost: `^${reboostPackageVersions['core']}`,
  litElement: '^2.3.1',
  electron: '^9.0.4',
  preact: '^10.4.5',
  reboostPluginSvelte: `^${reboostPackageVersions['plugin-svelte']}`,
  svelte: '^3.23.2',
  react: '^16.13.1',
  reactDom: '^16.13.1',
  vue: '^3.0.0-beta.20',
  reboostPluginVue: `^${reboostPackageVersions['plugin-vue']}`
}
