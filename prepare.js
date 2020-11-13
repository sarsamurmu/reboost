/* eslint-disable indent */
// @ts-check
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();

if (args.length > 1) {
  console.log('Prepare script accepts only one argument');
} else {
  switch (command) {
    case 'rm-dist': {
      const rmDir = (dirPath) => {
        if (!fs.existsSync(dirPath)) return;
        fs.readdirSync(dirPath).forEach((file) => {
          const filePath = path.join(dirPath, file);
          if (fs.lstatSync(filePath).isDirectory()) return rmDir(filePath);
          fs.unlinkSync(filePath);
        });
        fs.rmdirSync(dirPath);
      }

      rmDir(path.join(cwd, 'dist'));

      break;
    }

    case 'update-changelog': {
      const changelogFilePath = path.join(cwd, 'CHANGELOG.md');
      const packageJSONPath = path.join(cwd, 'package.json');
      if (!fs.existsSync(changelogFilePath)) {
        console.log(`Changelog file does not exist in ${cwd}`);
        break;
      }
      const changelogContent = fs.readFileSync(changelogFilePath).toString();
      const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath).toString());
      fs.writeFileSync(
        changelogFilePath,
        changelogContent.replace('## next', `## ${packageJSON.version}`)
      );
    }
  }
}
