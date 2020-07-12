import plopFunc from 'node-plop';

import fs from 'fs';
import path from 'path';

import { versions } from './versions';

type NodePlopAPI = ReturnType<typeof plopFunc>;

export = (plop: NodePlopAPI) => {
  const templatesDir = path.join(__dirname, '../templates');
  const templates = fs.readdirSync(templatesDir)
    .filter((file) => fs.lstatSync(path.join(templatesDir, file)).isDirectory());

  plop.load('plop-pack-npm-install', undefined, undefined);

  const prompts = [
    {
      type: 'input',
      name: 'appName',
      message: "What is your app's name",
      validate: (val: string) => val.trim() !== ''
    },
    {
      type: 'list',
      name: 'template',
      message: 'Choose template',
      choices: templates,
      default: 'vanilla'
    },
    {
      type: 'input',
      name: 'root',
      message: 'Where to extract the files',
      default: (answers: any) => './' + answers.appName
    },
    {
      type: 'confirm',
      name: 'shouldInstall',
      message: 'Do you want to install dependencies (using "npm i")',
      default: true
    }
  ];

  plop.setGenerator('default', {
    description: '',
    prompts,
    actions: (answers) => {
      const actions: any[] = [
        {
          type: 'addMany',
          destination: path.join(process.cwd(), '{{ root }}'),
          base: '../templates/{{ template }}',
          templateFiles: '../templates/{{ template }}/**/*',
          data: {
            versions
          },
          globOptions: {
            ignore: ['**/node_modules/**']
          }
        }
      ];

      if (answers.shouldInstall) {
        actions.push({
          type: 'npmInstall',
          path: path.join(process.cwd(), answers.root),
          verbose: true
        });
      }

      return actions;
    }
  });
}
