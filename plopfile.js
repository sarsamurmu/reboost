// @ts-check
const fs = require('fs');
const path = require('path');

/** @param plop {import('plop').NodePlopAPI} */
module.exports = (plop) => {
  plop.setGenerator('plugin', {
    description: 'Create a plugin',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Name of the plugin (ex. Vue, PostCSS)'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description of the plugin',
        default: ({ name }) => `${name} plugin for Reboost`,
      }
    ],
    actions: [
      {
        type: 'addMany',
        destination: './packages/plugin-{{ lowerCase name }}',
        templateFiles: './plugin-template/**/*',
        globOptions: { dot: true },
        data: {
          version: JSON.parse(fs.readFileSync(path.join(__dirname, './lerna.json'), 'utf8')).version
        }
      }
    ]
  });
}
