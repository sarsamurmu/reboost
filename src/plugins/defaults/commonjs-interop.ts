import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

import { ReboostPlugin } from '../../index';

export const CommonJSInteropPlugin: ReboostPlugin = {
  setup(_, __, router) {
    const importerFunc = () => ({
      Default(mod: any, filePath: string, sourcePath: string) {
        const message = `The requested module "${sourcePath}" does not provide an export named "default". Module Imported in "${filePath}"`;

        if (mod.__cjsModule && mod.default.__esModule) {
          if (!('default' in mod.default)) throw new SyntaxError(message);
          return mod.default.default;
        }
        if (!('default' in mod)) throw new SyntaxError(message);
        return mod.default;
      },
      Member(mod: any, member: string, filePath: string, sourcePath: string) {
        const message = `The requested module "${sourcePath}" does not provide an export named "${member}". Module Imported in "${filePath}"`;

        if (mod.__cjsModule) {
          if (!(member in mod.default)) throw new SyntaxError(message);
          return mod.default[member];
        }
        if (!(member in mod)) throw new SyntaxError(message);
        return mod[member];
      },
      All(mod: any) {
        if (mod.__cjsModule) return mod.default;
        return mod;
      }
    })

    router.get('/importer', async (ctx) => {
      ctx.type = 'text/javascript';
      ctx.body = `export default (${importerFunc.toString()})()`;
    });
  },
  transformAST(ast, { traverse }, filePath) {
    if (!filePath.match(/node_modules/)) {
      let program: NodePath<t.Program>;
      let importerIdentifier: t.Identifier;
      const declarators: t.VariableDeclarator[] = [];
      const replacements: [NodePath<t.ImportDeclaration>, t.ImportDeclaration][] = [];

      traverse(ast, {
        Program(path) {
          program = path;
        },
        ImportDeclaration(path) {
          const identifier = path.scope.generateUidIdentifier('$import');
          if (!importerIdentifier) importerIdentifier = path.scope.generateUidIdentifier('$importer');

          path.node.specifiers.forEach((specifier) => {
            let usage;
            let importedName;
            const localName = specifier.local.name;
            const commons = [
              t.stringLiteral(filePath),
              t.callExpression(
                t.identifier('__reboost_resolve'),
                [t.stringLiteral(path.node.source.value)]
              )
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
            ], t.stringLiteral(path.node.source.value))
          ]);
        }
      });

      if (importerIdentifier) {
        replacements.forEach(([path, replacement]) => {
          path.replaceWith(replacement);
        });

        program.node.body.unshift(
          t.importDeclaration([
            t.importDefaultSpecifier(importerIdentifier)
          ], t.stringLiteral('#/importer'))
        );

        const last = program.get('body').filter((path) => path.isImportDeclaration()).pop();
        const constDeclaration = t.variableDeclaration('const', declarators);
        if (last) {
          last.insertAfter(constDeclaration);
        } else {
          program.node.body.unshift(constDeclaration);
        }
      }
    }
  }
}
