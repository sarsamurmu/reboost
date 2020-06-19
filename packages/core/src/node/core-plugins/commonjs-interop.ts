import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

import { ReboostPlugin } from '../index';

export const CommonJSInteropPlugin: ReboostPlugin = {
  name: 'core-commonjs-interop-plugin',
  transformAST(ast, { traverse }, filePath) {
    let program: NodePath<t.Program>;
    let importerIdentifier: t.Identifier;
    const replacements: [NodePath<t.ImportDeclaration>, t.ImportDeclaration, t.VariableDeclarator[]][] = [];

    traverse(ast, {
      Program(path) {
        program = path;
      },
      ImportDeclaration(path) {
        const declarators: t.VariableDeclarator[] = [];
        const identifier = path.scope.generateUidIdentifier('$import');
        if (!importerIdentifier) importerIdentifier = path.scope.generateUidIdentifier('$importer');

        path.node.specifiers.forEach((specifier) => {
          let usage;
          let importedName;
          const localName = specifier.local.name;
          const commons = [
            t.callExpression(
              t.identifier('__reboost_resolve'),
              [t.stringLiteral(path.node.source.value)]
            ),
            t.stringLiteral(filePath)
          ];

          if (t.isImportDefaultSpecifier(specifier)) {
            usage = 'Default';
          } else if (t.isImportNamespaceSpecifier(specifier)) {
            usage = 'All';
          } else if (t.isImportSpecifier(specifier)) {
            usage = 'Member';
            importedName = specifier.imported.name;
          }

          declarators.push(
            t.variableDeclarator(
              t.identifier(localName),
              t.callExpression(
                t.memberExpression(
                  importerIdentifier,
                  t.identifier(usage)
                ),
                importedName ? [
                  identifier,
                  t.stringLiteral(importedName),
                  ...commons
                ] : [identifier, ...commons]
              )
            )
          );
        });

        replacements.push([
          path,
          t.importDeclaration([
            t.importNamespaceSpecifier(identifier)
          ], t.stringLiteral(path.node.source.value)),
          declarators
        ]);
      }
    });

    if (importerIdentifier) {
      replacements.forEach(([path, replacement, declarators]) => {
        path.replaceWith(replacement);
        if (declarators.length) {
          const constDeclaration = t.variableDeclaration('const', declarators);
          path.insertAfter(constDeclaration);
        }
      });

      program.node.body.unshift(
        t.importDeclaration([
          t.importDefaultSpecifier(importerIdentifier)
        ], t.stringLiteral(`#/importer`))
      );
    }
  }
}
