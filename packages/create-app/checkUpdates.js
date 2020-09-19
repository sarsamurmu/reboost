const checkForUpdate = require('update-check');
const { versions } = require('./dist/versions');

for (const name in versions) {
  if (!/^reboost/.test(name)) checkForUpdate({
    name: name.replace(/([A-Z])/g, (s) => '-' + s.toLowerCase()),
    version: versions[name].replace(/^\^/, ''),
  }, { interval: 0, distTag: 'latest' }).then((update) => {
    if (update) console.log(
      `Update available for dependency ${JSON.stringify(name)} - ${versions[name]} -> ${update.latest}`
    );
  }).catch((e) => console.log(`Failed for ${name}`, e));
}
