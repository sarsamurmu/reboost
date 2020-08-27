import puppeteer from 'puppeteer';

import fs from 'fs';
import path from 'path';

import { uniqueID } from 'src-node/utils';

let browser: puppeteer.Browser;
let pages: puppeteer.Page[] = [];

export const newPage = async (autoClose = true) => {
  if (!browser) browser = await puppeteer.launch();
  const page = await browser.newPage();
  if (autoClose) pages.push(page);
  return page;
}

export const closePages = async () => {
  await Promise.all((await browser.pages()).map((page, i) => i > 0 && page.close()));
}

afterEach(async () => {
  await Promise.all(pages.map((page) => page.close()));
  pages = [];
});

afterAll(async () => {
  if (browser) await browser.close();
  browser = null;
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
const fixtures = new Set<string>();

const clearEmptyFixtureDir = () => {
  if (fs.readdirSync(fixtureDir).length === 0) {
    fs.rmdirSync(fixtureDir);
  }
}

export const createFixture = ({
  $: {
    name = uniqueID(6),
    autoDelete = true
  } = {},
  ...directoryStructure
}: {
  $?: {
    name?: string;
    autoDelete?: boolean;
  }
} & DirectoryStructure): Fixture => {
  const baseDir = path.join(fixtureDir, name);

  return {
    p(filePath: string) {
      return path.join(baseDir, filePath);
    },
    apply() {
      makeFilesRecursive(baseDir, directoryStructure);
      if (autoDelete) fixtures.add(baseDir);
      return this;
    },
    rollback() {
      rmDirRecursive(baseDir);
      clearEmptyFixtureDir();
      if (autoDelete) fixtures.delete(baseDir);
      return this;
    }
  }
}

afterAll(() => {
  fixtures.forEach((fixture) => rmDirRecursive(fixture));
  clearEmptyFixtureDir();
});
