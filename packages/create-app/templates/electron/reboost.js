const { spawn } = require('child_process');
const { start } = require('reboost');

start({
  entries: [
    ['./src/index.js', './build/dist/index.js']
  ]
}).then(() => {
  spawn('npm', ['start'], {
    shell: true,
    stdio: 'inherit'
  }).on('exit', () => process.exit(0));
});
