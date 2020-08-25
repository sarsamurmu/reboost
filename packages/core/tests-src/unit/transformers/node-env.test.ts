import { runTransformation } from 'src-node/core-plugins/node-env';
import { createTransformer } from './transformer';

const nEnv = 'process.env.NODE_ENV';
const dev = "'development'";
const t = createTransformer((ast) => runTransformation(ast, 'development'));

test('transforms into boolean if `===` expression is used', () => {
  expect(t(`
    const isDev = ${nEnv} === ${dev};
  `)).toMatchSnapshot();
});

test('does not transforms into boolean if not confident', () => {
  expect(t(`
    const shouldDo = ${nEnv} === ${dev} && unknownVariable;
  `)).toMatchSnapshot();
});

describe('transforms conditional expressions', () => {
  test('consequent', () => {
    expect(t(`
      const scriptToUse = ${nEnv} === ${dev} ? 'dev.js' : 'prod.js';
    `)).toMatchSnapshot();
  });

  test('alternate', () => {
    expect(t(`
      const scriptToUse = ${nEnv} !== ${dev} ? 'prod.js' : 'dev.js';
    `)).toMatchSnapshot();
  });

  test('does nothing if not confident', () => {
    expect(t(`
      const shouldDo = ${nEnv} === ${dev} && unknownVariable ? 'yes' : 'no';
    `)).toMatchSnapshot();
  });
});

describe('transforms if expressions', () => {
  test('consequent with alternate', () => {
    expect(t(`
      if (${nEnv} === ${dev}) {
        doDev();
      } else {
        doProd();
      }
    `)).toMatchSnapshot();
  });

  test('consequent without alternate', () => {
    expect(t(`
      if (${nEnv} !== ${dev}) {
        doDev();
      }
    `)).toMatchSnapshot();
  });

  test('alternate', () => {
    expect(t(`
      if (${nEnv} !== ${dev}) {
        doProd();
      } else {
        doDev();
      }
    `)).toMatchSnapshot();
  });

  test('alternate if statement', () => {
    expect(t(`
      if (${nEnv} !== ${dev}) {
        doProd();
      } else if (someTest) {
        doSomeTest();
      } else {
        doElse();
      }
    `)).toMatchSnapshot();
  });

  test('does nothing if not confident', () => {
    expect(t(`
      if (${nEnv} !== ${dev} || unknownVariable) {
        doProd();
      }
    `)).toMatchSnapshot();
  });
});
