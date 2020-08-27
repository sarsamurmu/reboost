import { runTransformation } from 'src-node/core-plugins/node-env';
import { createTransformer } from './transformer';

const t = createTransformer((ast) => runTransformation(ast, 'development'));

test('transforms into boolean if `===` expression is used', () => {
  expect(t(`
    const isDev = process.env.NODE_ENV === 'development';
  `)).toMatchSnapshot();
});

test('does not transforms into boolean if not confident', () => {
  expect(t(`
    const shouldDo = process.env.NODE_ENV === 'development' && unknownVariable;
  `)).toMatchSnapshot();
});

describe('transforms conditional expressions', () => {
  test('consequent', () => {
    expect(t(`
      const scriptToUse = process.env.NODE_ENV === 'development' ? 'dev.js' : 'prod.js';
    `)).toMatchSnapshot();
  });

  test('alternate', () => {
    expect(t(`
      const scriptToUse = process.env.NODE_ENV !== 'development' ? 'prod.js' : 'dev.js';
    `)).toMatchSnapshot();
  });

  test('does nothing if not confident', () => {
    expect(t(`
      const shouldDo = process.env.NODE_ENV === 'development' && unknownVariable ? 'yes' : 'no';
    `)).toMatchSnapshot();
  });
});

describe('transforms if expressions', () => {
  test('consequent with alternate', () => {
    expect(t(`
      if (process.env.NODE_ENV === 'development') {
        doDev();
      } else {
        doProd();
      }
    `)).toMatchSnapshot();
  });

  test('consequent without alternate', () => {
    expect(t(`
      if (process.env.NODE_ENV !== 'development') {
        doDev();
      }
    `)).toMatchSnapshot();
  });

  test('alternate', () => {
    expect(t(`
      if (process.env.NODE_ENV !== 'development') {
        doProd();
      } else {
        doDev();
      }
    `)).toMatchSnapshot();
  });

  test('alternate if statement', () => {
    expect(t(`
      if (process.env.NODE_ENV !== 'development') {
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
      if (process.env.NODE_ENV !== 'development' || unknownVariable) {
        doProd();
      }
    `)).toMatchSnapshot();
  });
});
