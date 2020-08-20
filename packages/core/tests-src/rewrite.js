const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const shouldWatch = process.argv.slice(2).includes('-w');
const outDir = path.join(__dirname, '../tests');
const distNode = path.join(outDir, '../dist/node/');
const debug = (...args) => false && console.log(...args);

const lastRewrote = new Map();
const watcher = shouldWatch ? new chokidar.FSWatcher() : undefined;

watcher.on('change', rewriteScript);

function rewriteScript(filePath) {
  if (path.extname(filePath) !== '.js') return;
  if (
    lastRewrote.has(filePath) &&
    ((Date.now() - lastRewrote.get(filePath)) / 1000) < 0.5
  ) return;

  const code = fs.readFileSync(filePath).toString();
  const relative = path.relative(path.dirname(filePath), distNode).replace(/\\/g, '/');
  const output = code.replace(/src-node/g, relative);
  fs.writeFileSync(filePath, output);
  lastRewrote.set(filePath, Date.now());

  debug(`Rewrote ${path.relative(outDir, filePath)}`);
}

function rewriteScripts(dir) {
  fs.readdirSync(dir).forEach((fileOrDir) => {
    const full = path.join(dir, fileOrDir);
    if (fs.lstatSync(full).isDirectory()) {
      if (watcher) watcher.add(full);
      rewriteScripts(full);
    } else {
      if (watcher) watcher.add(full);
      rewriteScript(full);
    }
  });
}

const run = () => {
  try {
    rewriteScripts(outDir);
  } catch (e) {
    console.log(e);
    setTimeout(() => run(), 5000);
  }
}

run();
