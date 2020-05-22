import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

import { ReboostPlugin } from '../../index';
import { uniqueID } from '../../utils';

export const CommonJSPlugin: ReboostPlugin = {
  transformAST(ast, { traverse }) {
    let program: NodePath<t.Program>;
    let cjsModule = false;
    const uid = uniqueID(4);
    const modImports: t.ImportDeclaration[] = [];
    const importIdentifierMap = {} as Record<string, t.Identifier>;

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

          if (!(importPath in importIdentifierMap)) {
            importIdentifierMap[importPath] = importIdentifier;
            modImports.push(
              t.importDeclaration(
                [t.importDefaultSpecifier(importIdentifier)],
                t.stringLiteral(importPath)
              )
            );
          }

          path.replaceWith(importIdentifier);
        }
      },
      MemberExpression(path) {
        if (
          (t.isIdentifier(path.node.object, { name: 'module' }) &&
            t.isIdentifier(path.node.property, { name: 'exports' })) ||
          t.isIdentifier(path.node.object, { name: 'exports' })
        ) {
          cjsModule = true;
        }
      }
    });

    if (cjsModule) {
      program.node.body.unshift(
        t.exportNamedDeclaration(
          t.variableDeclaration(
            'const',
            [t.variableDeclarator(t.identifier('__cjsModule'), t.booleanLiteral(true))]
          )
        ),
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
              t.memberExpression(t.identifier('module'), t.identifier('exports'))
            )
          ]
        )
      );

      program.node.body.push(
        t.exportDefaultDeclaration(
          t.memberExpression(t.identifier('module'), t.identifier('exports'))
        )
      );
    }

    program.node.body.unshift(...modImports);
  }
}
