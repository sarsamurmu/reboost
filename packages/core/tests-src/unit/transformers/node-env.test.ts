import { runTransformation } from 'src-node/core-plugins/node-env';
import { createTransformer } from './transformer';

const nEnv = 'process.env.NODE_ENV';
const dev = "'development'";
const t = createTransformer((ast) => runTransformation(ast, 'development'));
const match = (code: string) => expect(t(code)).toMatchSnapshot();

test('transforms into boolean if `===` expression is used', () => {
  match(`
    const isDev = ${nEnv} === ${dev};
  `);
});

test('does not transforms into boolean if not confident', () => {
  match(`
    const shouldDo = ${nEnv} === ${dev} && unknownVariable;
  `);
});

describe('transforms conditional expressions', () => {
  test('consequent', () => {
    match(`
      const scriptToUse = ${nEnv} === ${dev} ? 'dev.js' : 'prod.js';
    `);
  });

  test('alternate', () => {
    match(`
      const scriptToUse = ${nEnv} !== ${dev} ? 'prod.js' : 'dev.js';
    `);
  });

  test('does nothing if not confident', () => {
    match(`
      const shouldDo = ${nEnv} === ${dev} && unknownVariable ? 'yes' : 'no';
    `);
  });
});

describe('transforms if expressions', () => {
  test('consequent with alternate', () => {
    match(`
      if (${nEnv} === ${dev}) {
        doDev();
      } else {
        doProd();
      }
    `);
  });

  test('consequent without alternate', () => {
    match(`
      if (${nEnv} !== ${dev}) {
        doDev();
      }
    `);
  });

  test('alternate', () => {
    match(`
      if (${nEnv} !== ${dev}) {
        doProd();
      } else {
        doDev();
      }
    `);
  });

  test('alternate if statement', () => {
    match(`
      if (${nEnv} !== ${dev}) {
        doProd();
      } else if (someTest) {
        doSomeTest();
      } else {
        doElse();
      }
    `);
  });

  test('does nothing if not confident', () => {
    match(`
      if (${nEnv} !== ${dev} || unknownVariable) {
        doProd();
      }
    `);
  });
});
