const fs = require('fs');
const path = require('path');

const destFile = path.join(__dirname, '../tests/requireAll.test.js');
const destDir = path.dirname(destFile);
let fileContent = '';

const scanDir = (dir) => {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (path.extname(file) === '.js') {
      const relativePath = path.relative(destDir, fullPath).replace(/\\/g, '/');
      fileContent += `require(${JSON.stringify(relativePath)});\n`;
    }
  });
}

scanDir(path.join(__dirname, '../dist/node'));

fileContent += '\ntest(`Requires all`, () => {});\n';

fs.writeFileSync(destFile, fileContent);
