#!/usr/bin/env node

import yargs from 'yargs';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { start } from './index';

const options = yargs
  .usage('reboost [args]')
  .alias({
    'c': 'config'
  })
  .describe({
    'c': 'Path to config file'
  })
  .string('c')
  .default({
    'c': './reboost.config.js'
  })
  .alias('v', 'version')
  .alias('h', 'help')
  .help()
  .argv;

options.c = path.resolve(process.cwd(), options.c);

if (!fs.existsSync(options.c)) {
  let guidance = `Can't find config file at "${path.dirname(options.c)}"\n`;
  guidance += `Ensure that "${path.basename(options.c)}" exists in "${path.dirname(options.c)}"\n`;
  guidance += `Run "reboost --help" for help`;
  console.log(chalk.red(guidance));
  process.exit(1);
}

const config = require(options.c);

start(config);
