#!/usr/bin/env node

import { Command } from 'commander';
import nodePlop from 'node-plop';
import chalk from 'chalk';

import path from 'path';

const program = new Command();
const plop = nodePlop(path.join(__dirname, './plop.js'));

program
  .command('create')
  .description('create an app')
  .action(async () => {
    const generator = plop.getGenerator('main');
    const answers = await generator.runPrompts();
    await generator.runActions(answers);

    console.log(chalk.green('\nSuccessfully generated app!'));
  });

program.parse(process.argv);
