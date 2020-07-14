import { assert } from 'chai';
import { isVersionLessThan } from '../../src/node/utils';

describe('Utility functions', () => {
  it('compares versions', () => {
    assert.isTrue(isVersionLessThan('0.0.0', '0.0.1'));
    assert.isTrue(isVersionLessThan('0.0.0', '0.1.0'));
    assert.isTrue(isVersionLessThan('0.0.0', '1.0.0'));

    assert.isTrue(isVersionLessThan('0.0.1', '0.0.10'));
    assert.isTrue(isVersionLessThan('0.1.0', '0.10.0'));
    assert.isTrue(isVersionLessThan('1.0.0', '10.0.0'));
  });
});
