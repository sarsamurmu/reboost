import { parse } from '@babel/parser';
import generate from '@babel/generator';

export const createTransformer = (transform: (ast: any) => void) => (code: string) => {
  const ast = parse(code, {
    sourceType: 'module'
  });
  transform(ast);
  return generate(ast, {
    compact: false
  }).code;
}
