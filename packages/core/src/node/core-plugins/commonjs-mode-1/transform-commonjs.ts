import * as t from '@babel/types';
import traverse, { NodePath } from '@babel/traverse';

import { builtinModules } from 'module';

export const transformCommonJS = (ast: t.Node, id: string) => {
  let program: NodePath<t.Program>;
  let usedModuleExports = false;
  let usedExports = false;
  const modImports: t.ImportDeclaration[] = [];
  const importIdentifierMap: Record<string, t.Identifier> = {};

  traverse(ast, {
    Program(path) {
      program = path;
    },
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'require' }) &&
        path.node.arguments.length === 1 &&
        t.isStringLiteral(path.node.arguments[0]) &&
        !path.scope.hasBinding('require')
      ) {
        const importPath = path.node.arguments[0].value;
        const importIdentifier = importIdentifierMap[importPath] || path.scope.generateUidIdentifier(`$imported_${id}`);

        // Don't resolve built-in modules like path, fs, etc.
        if (builtinModules.includes(importPath)) return;

        if (!(importPath in importIdentifierMap)) {
          importIdentifierMap[importPath] = importIdentifier;
          modImports.push(
            t.importDeclaration(
              [t.importNamespaceSpecifier(importIdentifier)],
              t.stringLiteral(importPath)
            )
          );
        }

        path.replaceWith(importIdentifier);
      }
    },
    MemberExpression(path) {
      if (
        !usedModuleExports &&
        t.isIdentifier(path.node.object, { name: 'module' }) &&
        (
          path.node.computed
            ? t.isStringLiteral(path.node.property, { value: 'exports' })
            : t.isIdentifier(path.node.property, { name: 'exports' })
        )
      ) {
        if (!path.scope.hasBinding('module')) usedModuleExports = true;
      } else if (!usedExports && t.isIdentifier(path.node.object, { name: 'exports' })) {
        if (!path.scope.hasBinding('exports')) usedExports = true;
      }
    }
  });

  if (usedModuleExports || usedExports) {
    if (usedModuleExports) {
      program.node.body.unshift(
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier('module'),
              t.objectExpression([
                t.objectProperty(
                  t.identifier('exports'),
                  usedExports ? t.identifier('exports') : t.objectExpression([]),
                  false,
                  usedExports
                )
              ])
            ),
          ]
        )
      );
    }

    if (usedExports) {
      program.node.body.unshift(
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier('exports'),
              t.objectExpression([])
            )
          ]
        )
      );
    }

    program.node.body.push(
      t.exportNamedDeclaration(
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier('__cjsExports'),
              usedModuleExports
                ? t.memberExpression(t.identifier('module'), t.identifier('exports'))
                : t.identifier('exports')
            )
          ]
        )
      )
    );
  }

  program.node.body.unshift(...modImports);
}
