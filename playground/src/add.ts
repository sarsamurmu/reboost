export const add = (a: number, b: number): number => a + b;

export const doThing1 = (...args: any[]) => {
  console.log('Checking TypeScript source map', ...args);
  console.trace();
}

((...args: any[]) => doThing1(...args))(1, 2, 3, 4);
