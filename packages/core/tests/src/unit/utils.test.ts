import * as utils from '<thisPackage>/utils';

import fs from 'fs';

import { createFixture } from '../helpers/fixture';

test('transforms path to posix', () => {
  expect(utils.toPosix('some\\windows\\style\\path')).toBe('some/windows/style/path');
});

test('generates unique ID', () => {
  let id;
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    id = utils.uniqueID();
    expect(ids.has(id)).toBe(false);
    ids.add(id);
  }

  expect(utils.uniqueID(300)).toHaveLength(300);
});

test('checks if a data type is plain object', () => {
  expect(utils.isPlainObject({})).toBe(true);
  expect(utils.isPlainObject(null)).toBe(false);
  expect(utils.isPlainObject(new (class {}))).toBe(false);
});

test('merges two objects', () => {
  expect(utils.merge(
    {
      common: { prop2: 9 },
      prop1: 4
    },
    {
      common: { prop1: 7 },
      prop2: 1
    }
  )).toEqual({
    common: { prop1: 7, prop2: 9 },
    prop1: 4,
    prop2: 1
  });
});

test('clones an object', () => {
  const main = {
    prop1: 7,
    prop2: { prop21: 6, prop22: 4 },
    arr: [1, 2, 3]
  };
  const clone = utils.clone(main);
  
  expect(clone).toEqual(main);

  clone.prop1 = clone.prop2.prop21 = 0;
  clone.arr.push(4, 5, 6);

  expect(clone).not.toEqual(main);
});

test('ensures a directory', () => {
  const dirPath = 'some-dir/with/nested/dirs';
  const availableDirPath = 'path/to/available/dir';
  const fixture = createFixture({
    [availableDirPath]: {
      'file-a': ''
    }
  }).apply();

  utils.ensureDir(fixture.p(dirPath));
  expect(fs.existsSync(fixture.p(dirPath))).toBe(true);

  // Does nothing if the directory already exists
  expect(() => utils.ensureDir(fixture.p(availableDirPath))).not.toThrow();
});

test('checks if a file is directory', () => {
  const dirPath = 'path/to/a/dir';
  const filePath = 'path/to/a/file';
  const fixture = createFixture({
    [dirPath]: {},
    [filePath]: ''
  }).apply();

  expect(utils.isDirectory(fixture.p(dirPath))).toBe(true);
  expect(utils.isDirectory(fixture.p(filePath))).toBe(false);
});

test('removes a directory', () => {
  const dirPath = '/path/to/a/dir';
  const unavailableDirPath = 'path/to/unavailable/dir';
  const fixture = createFixture({
    [dirPath]: {
      'file-a': '',
      'file-b': '',
      'nested': {
        'file-x': '',
        'file-y': ''
      }
    }
  }).apply();

  utils.rmDir(fixture.p(dirPath));
  expect(fs.existsSync(fixture.p(dirPath))).toBe(false);

  // Does nothing if the directory does not exist
  expect(() => utils.rmDir(fixture.p(unavailableDirPath))).not.toThrow();
});

test('deeply freezes an object', () => {
  const obj = {
    prop1: 6,
    prop2: {
      prop21: 7,
      prop22: 1,
      arr: [1, 2, 3]
    },
    arr: [4, 5, 6]
  };
  const cant = {
    assign: /cannot assign/i,
    add: /cannot add property/i
  };

  utils.deepFreeze(obj);

  expect(() => obj.prop1 = 0).toThrowError(cant.assign);
  expect(() => obj.prop2.prop21 = 0).toThrowError(cant.assign);
  expect(() => (obj as any).prop3 = 0).toThrowError(cant.add);
  expect(() => (obj.prop2 as any).prop23 = 0).toThrowError(cant.add);
  expect(() => obj.arr.push(0)).toThrowError(cant.add);
  expect(() => obj.prop2.arr.push(0)).toThrowError(cant.add);
});

test('creates observable', () => {
  const mock = jest.fn();
  const obj = utils.observable({
    prop: 0,
    nested: {
      prop: 0,
      nested: {
        prop: 0,
        nested: {
          prop: 0,
        }
      }
    }
  }, mock);

  obj.prop = 1;
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();
  obj.nested.prop = 1;
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();
  obj.nested.nested.prop = 1;
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();
  obj.nested.nested.nested.prop = 1;
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();

  obj.nested.nested = {
    prop: 2,
    nested: { prop: 2 }
  };
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();
  obj.nested.nested.prop = 1;
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();
  obj.nested.nested.nested.prop = 1;
  expect(mock).toBeCalledTimes(1);
  mock.mockReset();
});

test('get property paths from an object', () => {
  expect(utils.objectPaths({ a: 0 })).toEqual(expect.arrayContaining(['a']));
  expect(utils.objectPaths({
    1: {
      a: 0,
      b: 0,
    },
    2: {
      e: 0,
      f: 0,
    }
  })).toEqual(expect.arrayContaining(['1.a', '1.b', '2.e', '2.f']));
});

test('serializes an object', () => {
  expect(utils.serializeObject({
    c: 0,
    a: 1,
    b: 7,
    d: 4,
    nest: {
      f: 1,
      e: 2,
      nest: {
        j: 4,
        i: 6
      }
    }
  })).toBe(JSON.stringify([
    ['a', 1],
    ['b', 7],
    ['c', 0],
    ['d', 4],
    ['nest', [
      ['e', 2],
      ['f', 1],
      ['nest', [
        ['i', 6],
        ['j', 4]
      ]]
    ]]
  ]));

  expect(utils.serializeObject({
    1: /myRegExp/i
  })).toBe('[["1","/myRegExp/i"]]');
  expect(utils.serializeObject({
    1: eval('() => { return true }') // Using eval to prevent TypeScript from formatting the code
  })).toBe('[["1","() => { return true }"]]');

  const objectToSerialize = {
    a: 1,
    b: 2,
    c: 3,
    nest: {
      e: 1,
      f: 2,
      g: 3,
      nest: {
        i: 1,
        j: 2,
        k: 3
      }
    }
  };
  const serializedObject = JSON.stringify([
    ['b', 2],
    ['c', 3],
    ['nest', [
      ['e', 1],
      ['g', 3],
      ['nest', [
        ['i', 1],
        ['j', 2]
      ]]
    ]]
  ]);

  expect(utils.serializeObject(objectToSerialize, [
    'a',
    'nest.f',
    'nest.nest.k'
  ])).toBe(serializedObject);
  expect(utils.serializeObject(objectToSerialize, {
    a: {},
    nest: {
      f: {},
      nest: {
        k: {}
      }
    }
  })).toBe(serializedObject);
});

test('binds a function', () => {
  const bound = utils.bind(function (this: { val: number }) {
    return this.val;
  }, { val: 0 });

  expect(bound()).toBe(0);
});

test('finds diff in old and new arrays', () => {
  const oldArr = [1, 2, 3, 4];
  const newArr = [3, 4, 5, 6];
  const { added, removed } = utils.diff(oldArr, newArr);

  expect(added).toEqual(expect.arrayContaining([5, 6]));
  expect(removed).toEqual(expect.arrayContaining([1, 2]));
});

test('checks if a version is less then another version', () => {
  ([
    ['0.0.0', '0.0.1', true],
    ['0.0.0', '0.1.0', true],
    ['0.0.0', '1.0.0', true],
    ['0.0.1', '0.0.0', false],
    ['0.1.0', '0.0.0', false],
    ['1.0.0', '0.0.0', false],
    ['1.1.1', '1.1.1', false]
  ] as [string, string, boolean][]).forEach(([version, toCompareWith, expected]) => {
    expect(utils.isVersionLessThan(version, toCompareWith)).toBe(expected);
  });
});
