import * as t from '@babel/types';
import traverse, { NodePath } from '@babel/traverse';

import { builtinModules } from 'module';

import { uniqueID } from '../../utils';

export const transformCommonJS = (ast: t.Node) => {
  let program: NodePath<t.Program>;
  let cjsModule = false;
  const uid = uniqueID(4);
  const modImports: t.ImportDeclaration[] = [];
  const importIdentifierMap: Record<string, t.Identifier> = {};

  traverse(ast, {
    Program(path) {
      program = path;
    },
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'require' }) &&
        t.isStringLiteral(path.node.arguments[0])
      ) {
        const importPath = path.node.arguments[0].value;
        const importIdentifier = importIdentifierMap[importPath] || path.scope.generateUidIdentifier(`$imported_${uid}`);

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
      if (cjsModule) return;
      if (
        t.isIdentifier(path.node.object, { name: 'module' }) &&
        (
          path.node.computed
            ? t.isStringLiteral(path.node.property, { value: 'exports' })
            : t.isIdentifier(path.node.property, { name: 'exports' })
        )
      ) {
        if (!path.scope.hasBinding('module')) cjsModule = true;
      } else if (t.isIdentifier(path.node.object, { name: 'exports' })) {
        if (!path.scope.hasBinding('exports')) cjsModule = true;
      }
    }
  });

  if (cjsModule) {
    const moduleExportsExp = t.memberExpression(t.identifier('module'), t.identifier('exports'));

    program.node.body.unshift(
      t.variableDeclaration(
        'const',
        [
          t.variableDeclarator(
            t.identifier('module'),
            t.objectExpression([
              t.objectProperty(
                t.identifier('exports'),
                t.objectExpression([])
              )
            ])
          ),
        ]
      ),
      t.variableDeclaration(
        'const',
        [
          t.variableDeclarator(
            t.identifier('exports'),
            moduleExportsExp
          )
        ]
      )
    );

    program.node.body.push(
      t.exportNamedDeclaration(
        t.variableDeclaration(
          'const',
          [t.variableDeclarator(
            t.identifier('__cjsExports'),
            moduleExportsExp
          )]
        )
      )
    );
  }

  program.node.body.unshift(...modImports);
}
