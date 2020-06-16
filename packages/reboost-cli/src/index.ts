#!/usr/bin/env node

import { Command } from 'commander';
import nodePlop from 'node-plop';
import chalk from 'chalk';
import checkUpdate, { Result as UpdateResult } from 'update-check';

import fs from 'fs';
import path from 'path';

const program = new Command();
const plop = nodePlop(path.join(__dirname, './plop.js'));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json')).toString());

let update: UpdateResult;

const showUpdateMessage = () => {
  let message = chalk.green(`\nUpdate available - ${chalk.reset(pkg.version)} -> ${chalk.blue(update.latest)}\n`);
  message += chalk.green('Please use the latest version for new features and better stability.\n');
  message += chalk.green(`Run ${chalk.cyan(`npm i -g ${pkg.name}`)} to install the latest version.\n`);

  console.log(message);
}

const checkNew = async () => {
  if (update) return;
  try {
    update = await checkUpdate(pkg);
  } catch (e) {}
}

checkNew();

program
  .command('create')
  .description('create an app')
  .action(async () => {
    const generator = plop.getGenerator('main');
    const answers = await generator.runPrompts();
    await generator.runActions(answers);

    console.log(chalk.green(`\nDone!`));

    console.log(chalk.cyan('\nChecking for updates...'));
    await checkNew();
    if (update) return showUpdateMessage();
    console.log(chalk.cyan('Using the latest version!'));
  });

program.parse(process.argv);
