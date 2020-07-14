import mockFS from 'mock-fs';
import { assert } from 'chai';

import path from 'path';

import { resolve } from '../../src/node/core-plugins/resolver';

afterEach(() => mockFS.restore());

const base = 'path/to/base';
const f = (p: string) => path.join(base, p);

describe('Module Resolver', () => {
  it('resolves extensions', () => {
    const mainF = f('main.js');
    const JSF = f('javascript.js');
    const TSF = f('typescript.ts');

    mockFS({
      [mainF]: '',
      [JSF]: '',
      [TSF]: ''
    });

    assert.equal(resolve(mainF, './javascript'), JSF);
    assert.equal(resolve(mainF, './typescript', {
      extensions: ['.ts']
    }), TSF);
  });

  it('resolves mainFile', () => {
    const mainF = f('main.js');
    const dF = f('folder/index.js');
    const dOF = f('folder/other.js');

    mockFS({
      [mainF]: '',
      [dF]: '',
      [dOF]: ''
    });

    assert.equal(resolve(mainF, './folder'), dF);
    assert.equal(resolve(mainF, './folder', {
      mainFiles: ['other']
    }), dOF);
  });
});
