import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

import { builtinModules } from 'module';

import { ReboostPlugin } from '../index';
import { uniqueID } from '../utils';

export const isDeclared = (path: NodePath<any>, identifierName: string, findInProgram = true) => {
  const findInDeclarators = (id: t.LVal) => {
    let found = false;
    if (t.isIdentifier(id, { name: identifierName })) {
      found = true;
    } else if (t.isArrayPattern(id)) {
      id.elements.forEach((element) => {
        if (found) return;
        found = findInDeclarators(element);
      });
    } else if (t.isObjectPattern(id)) {
      id.properties.forEach((property) => {
        if (found) return;

        if (t.isRestElement(property)) {
          found = t.isIdentifier(property.argument, { name: identifierName });
        } else {
          found = findInDeclarators(property.value as any);
        }
      });
    }
    return found;
  }

  const findInParent = (astPath: NodePath<any>): boolean => {
    let found = false;

    const parent: NodePath<t.BlockStatement | t.Program> = astPath.findParent(
      (p) => p.isBlockStatement() || (findInProgram && p.isProgram())
    ) as any;
    if (parent) {
      parent.node.body.forEach((item) => {
        if (found) return;

        if (t.isVariableDeclaration(item)) {
          item.declarations.forEach((declaration) => {
            if (found) return;

            found = findInDeclarators(declaration.id);
          });
        }
      });

      if (!found) return findInParent(parent);
    }

    return found;
  }

  return findInParent(path);
}

export const CommonJSPlugin: ReboostPlugin = {
  name: 'core-commonjs-plugin',
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
          t.isIdentifier(path.node.property, { name: 'exports' })
        ) {
          if (!isDeclared(path, 'module')) cjsModule = true;
        } else if (t.isIdentifier(path.node.object, { name: 'exports' })) {
          if (!isDeclared(path, 'exports')) cjsModule = true;
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
}
