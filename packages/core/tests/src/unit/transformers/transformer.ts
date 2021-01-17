import { parseModule } from 'meriyah';
import { generate } from 'escodegen';
import { NodePath, types as t, traverse } from 'estree-toolkit';

export const createTransformer = (
  transform: (programPath: NodePath<t.Program>) => void
) => (code: string) => {
  let programPath: NodePath<t.Program>;
  traverse(parseModule(code), {
    $: { scope: true },
    Program: (path) => programPath = path
  });
  transform(programPath);
  return generate(programPath.node, {
    format: {
      indent: { style: '  ' }
    }
  });
}
