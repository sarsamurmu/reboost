const checkForUpdate = require('update-check');
const { versions } = require('./dist/versions');

(async () => {
  const availableUpdates = {};

  for (const name in versions) {
    if (!/^reboost/.test(name)) {
      try {
        const update = await checkForUpdate(
          {
            name: name.replace(/([A-Z])/g, (s) => '-' + s.toLowerCase()),
            version: versions[name].replace(/^\^/, ''),
          }, {
            interval: 0,
            distTag: 'latest'
          }
        );

        console.log(update
          ? `Update available for dependency ${JSON.stringify(name)} - ${versions[name]} -> ${update.latest}`
          : `No update available for dependency ${JSON.stringify(name)}`
        );

        if (update) availableUpdates[name] = update.latest;
      } catch (e) {
        console.log(`Failed for ${name}`, e);
      }
    }
  }

  const updates = Object.keys(availableUpdates);

  if (updates.length) {
    console.log('\n\nUpdates:');

    updates.forEach((name) => {
      console.log(`  ${name}: ${versions[name]} -> ${availableUpdates[name]}`);
    });
  } else {
    console.log('All versions are up-to-date');
  }
})();
