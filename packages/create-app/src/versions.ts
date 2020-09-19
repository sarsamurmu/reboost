import fs from 'fs';
import path from 'path';

const reboostPackageVersions = JSON.parse(
  fs.readFileSync(path.join(__dirname, './package-versions.json')).toString()
);

export const versions: Record<string, string> = {
  reboost: reboostPackageVersions['core'],
  litElement: '2.4.0',
  electron: '10.1.2',
  preact: '10.4.8',
  reboostPluginSvelte: reboostPackageVersions['plugin-svelte'],
  svelte: '3.25.1',
  react: '16.13.1',
  reactDom: '16.13.1',
  reboostPluginReactRefresh: reboostPackageVersions['plugin-react-refresh'],
  vue: '3.0.0',
  reboostPluginVue: reboostPackageVersions['plugin-vue'],
};

for (const key in versions) versions[key] = '^' + versions[key];
