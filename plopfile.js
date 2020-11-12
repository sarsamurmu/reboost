// @ts-check
const fs = require('fs');
const path = require('path');

module.exports = (
  /** @type {import('plop').NodePlopAPI} */
  plop
) => {
  plop.setGenerator('plugin', {
    description: 'Create a plugin',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Name of the plugin (excluding starting "plugin-")'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description of the plugin'
      }
    ],
    actions: [
      {
        type: 'addMany',
        destination: './packages/plugin-{{ name }}',
        templateFiles: './plugin-template/**/*',
        globOptions: { dot: true },
        data: {
          version: JSON.parse(fs.readFileSync(path.join(__dirname, './lerna.json')).toString()).version
        }
      }
    ]
  });
}
