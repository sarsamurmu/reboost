import { isVersionLessThan } from 'src-node/utils';

test('compares versions', () => {
  expect(isVersionLessThan('0.0.0', '0.0.1')).toBe(true);
  expect(isVersionLessThan('0.0.0', '0.0.1')).toBe(true);
  expect(isVersionLessThan('0.0.0', '0.1.0')).toBe(true);
  expect(isVersionLessThan('0.0.0', '1.0.0')).toBe(true);

  expect(isVersionLessThan('0.0.1', '0.0.10')).toBe(true);
  expect(isVersionLessThan('0.1.0', '0.10.0')).toBe(true);
  expect(isVersionLessThan('1.0.0', '10.0.0')).toBe(true);

  expect(isVersionLessThan('0.7.0', '0.6.1')).toBe(false);
});
