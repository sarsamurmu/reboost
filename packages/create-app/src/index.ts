#!/usr/bin/env node

import nodePlop from 'node-plop';
import chalk from 'chalk';

import path from 'path';

const plop = nodePlop(path.join(__dirname, './plop.js'));

(async () => {
  const generator = plop.getGenerator('default');
  const answers = await generator.runPrompts();
  await generator.runActions(answers);

  console.log(chalk.green('\nDone!'));
})();
