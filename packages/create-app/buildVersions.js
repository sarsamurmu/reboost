const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '../');
const distDir = path.join(__dirname, 'dist');
const packageVersions = {};

fs.readdirSync(packagesDir).forEach((dirName) => {
  // Just in case we store non-directory file in packages dir
  if (!fs.lstatSync(path.join(packagesDir, dirName)).isDirectory()) return;

  const pkgJSON = JSON.parse(
    fs.readFileSync(path.join(packagesDir, dirName, 'package.json'), 'utf8')
  );
  packageVersions[dirName] = pkgJSON.version;
});

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

fs.writeFileSync(
  path.join(distDir, './package-versions.json'),
  JSON.stringify(packageVersions, null, 2)
);
