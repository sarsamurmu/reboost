import plopFunc from 'node-plop';

import fs from 'fs';
import path from 'path';

type NodePlopAPI = ReturnType<typeof plopFunc>;

const version = '0.x.x';

export = (plop: NodePlopAPI) => {
  const templatesDir = path.join(__dirname, '../templates');
  const templates = fs.readdirSync(templatesDir)
    .filter((file) => fs.lstatSync(path.join(templatesDir, file)).isDirectory());

  plop.load('plop-pack-npm-install', undefined, undefined);

  plop.setGenerator('main', {
    description: 'Main logic',
    prompts: [
      {
        type: 'input',
        name: 'appName',
        message: `What is your app's name`,
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
    ],
    actions: (answers) => {
      const actions: any[] = [
        {
          type: 'addMany',
          destination: path.join(process.cwd(), '{{ root }}'),
          base: '../templates/{{ template }}',
          templateFiles: '../templates/{{ template }}/**/*',
          data: {
            version
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
