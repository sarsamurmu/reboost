import * as utils from 'src-node/utils';

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

test('checks if a data type is object', () => {
  expect(utils.isObject({})).toBe(true);
  expect(utils.isObject(null)).not.toBe(true);
  expect(utils.isObject(new (class {}))).not.toBe(true);
});

test('compares versions', () => {
  expect(utils.isVersionLessThan('0.0.0', '0.0.1')).toBe(true);
  expect(utils.isVersionLessThan('0.0.0', '0.0.1')).toBe(true);
  expect(utils.isVersionLessThan('0.0.0', '0.1.0')).toBe(true);
  expect(utils.isVersionLessThan('0.0.0', '1.0.0')).toBe(true);

  expect(utils.isVersionLessThan('0.0.1', '0.0.10')).toBe(true);
  expect(utils.isVersionLessThan('0.1.0', '0.10.0')).toBe(true);
  expect(utils.isVersionLessThan('1.0.0', '10.0.0')).toBe(true);

  expect(utils.isVersionLessThan('0.7.0', '0.6.1')).toBe(false);
});
