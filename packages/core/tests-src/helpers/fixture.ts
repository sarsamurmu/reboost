import fs from 'fs';
import path from 'path';

import { uniqueID } from 'src-node/utils';

type DirectoryStructure = {
  [filePath: string]: string | DirectoryStructure;
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

interface Fixture {
  isUsed: boolean;
  baseDir: string;
  autoDelete: boolean;
  p(filePath: string): string;
  apply(): Fixture;
  rollback(): Fixture;
}

const fixtureDir = path.join(__dirname, '../../__fixtures__');
const fixtures = new Set<Fixture>();

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
  let used: boolean;
  const baseDir = path.join(fixtureDir, name);

  const fixture: Fixture = {
    get isUsed() {
      return used;
    },
    get baseDir() {
      return baseDir;
    },
    autoDelete,
    p(filePath: string) {
      return path.join(baseDir, filePath);
    },
    apply() {
      used = true;
      makeFilesRecursive(baseDir, directoryStructure);
      return this;
    },
    rollback() {
      rmDirRecursive(baseDir);
      clearEmptyFixtureDir();
      return this;
    }
  }

  fixtures.add(fixture);

  return fixture;
}

afterAll(() => {
  fixtures.forEach((fixture) => {
    if (!fixture.isUsed) {
      // Throwing this error because it's easy to create a fixture and
      // forget to call `.apply()` method. It can cause problems like
      // file not found etc.
      throw new Error(
        `A fixture is left unused in test - ${JSON.stringify(expect.getState().currentTestName)}. ` +
        'Use `.apply()` to use it.'
      );
    }

    if (fixture.autoDelete) rmDirRecursive(fixture.baseDir);
  });

  clearEmptyFixtureDir();
  fixtures.clear();
});
