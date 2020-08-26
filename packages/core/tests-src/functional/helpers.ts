import puppeteer from 'puppeteer';

import fs from 'fs';
import path from 'path';

import { uniqueID } from 'src-node/utils';

let browser: puppeteer.Browser;
let page: puppeteer.Page;

export const newPage = async () => {
  if (!browser) browser = await puppeteer.launch();
  if (page) await page.close();
  return (page = await browser.newPage());
}
export const getPage = async () => page || await newPage();

afterAll(async () => {
  if (browser) await browser.close();
  browser = null;
  page = null;
});

type DirectoryStructure = {
  [filePath: string]: string | DirectoryStructure;
}

interface Fixture {
  p(filePath: string): string;
  apply(): Fixture;
  rollback(): Fixture;
}

const makeFilesRecursive = (base: string, structure: DirectoryStructure) => {
  Object.keys(structure).forEach((key) => {
    const fullPath = path.join(base, key);
    const content = structure[key];

    if (typeof content === 'object') {
      fs.mkdirSync(fullPath, { recursive: true });
      makeFilesRecursive(fullPath, content);
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  });
}

const rmDirRecursive = (dirPath: string) => {
  fs.readdirSync(dirPath).forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      rmDirRecursive(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  });
  fs.rmdirSync(dirPath);
}

const fixtureDir = path.join(__dirname, '../../__fixtures__');
export const createFixture = ({
  $: options,
  ...directoryStructure
}: {
  $?: string | {
    name: string;
  }
} & DirectoryStructure): Fixture => {
  const name = typeof options === 'string'
    ? options
    : typeof options === 'object'
      ? options.name
      : uniqueID(4);
  const baseDir = path.join(fixtureDir, name);

  return {
    p(filePath: string) {
      return path.join(baseDir, filePath);
    },
    apply() {
      makeFilesRecursive(baseDir, directoryStructure);

      return this;
    },
    rollback() {
      rmDirRecursive(baseDir);

      if (fs.readdirSync(fixtureDir).length === 0) {
        fs.rmdirSync(fixtureDir);
      }

      return this;
    }
  }
}
