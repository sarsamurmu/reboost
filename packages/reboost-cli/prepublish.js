const fs = require('fs');
const path = require('path');

const rmDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) return;
  fs.readdirSync(dirPath).forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.lstatSync(filePath).isDirectory()) return rmDir(filePath);
    fs.unlinkSync(filePath);
  });
  fs.rmdirSync(dirPath);
}

rmDir(path.join(__dirname, 'dist'));
