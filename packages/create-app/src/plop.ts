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

  interface Answers {
    name: string;
    template: string;
    root: string;
    installDeps: boolean;
  }

  const prompts: {
    name: keyof Answers;
    [key: string]: any;
  }[] = [
    {
      type: 'input',
      name: 'name',
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
      default: (answers: any) => './' + answers.name
    },
    {
      type: 'confirm',
      name: 'installDeps',
      message: 'Do you want to install dependencies (using "npm i")',
      default: true
    }
  ];

  plop.setGenerator('default', {
    description: '',
    prompts,
    actions: (answers: Answers) => {
      const actions: any[] = [
        {
          type: 'addMany',
          destination: path.join(process.cwd(), answers.root),
          base: `../templates/${answers.template}`,
          templateFiles: `../templates/${answers.template}/**/*`,
          data: {
            versions,
            appName: answers.name
          },
          globOptions: {
            ignore: ['**/node_modules/**']
          }
        }
      ];

      if (answers.installDeps) {
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
