import * as t from '@babel/types';
import traverse, { NodePath } from '@babel/traverse';

import { builtinModules } from 'module';

const getReboostResolveCall = (source: string) => t.callExpression(
  t.identifier('__reboost_resolve'),
  [t.stringLiteral(source)]
);

export const transformCommonJS = (ast: t.Node, filePath: string, id: string) => {
  let program: NodePath<t.Program>;
  let usedModuleExports: boolean;
  let usedExports: boolean;
  let modImports: t.ImportDeclaration[];
  let importIdentifierMap: Record<string, t.Identifier>;
  const importerIdentifier: t.Identifier = t.identifier(`importer_${id}`);
  let usedImporter: boolean;
  let replacements: [NodePath<t.ImportDeclaration>, t.ImportDeclaration, t.VariableDeclarator[]][];
  let importIdx = 0;

  traverse(ast, {
    Program(path) {
      program = path;
      if (path.scope.hasGlobal('module')) usedModuleExports = true;
      if (path.scope.hasGlobal('exports')) usedExports = true;
    },
    ImportDeclaration(path) {
      if (path.node.specifiers.length === 0) return;

      const declarators: t.VariableDeclarator[] = [];
      const identifier = t.identifier(`import_${importIdx++}_${id}`);

      usedImporter = true;

      path.node.specifiers.forEach((specifier) => {
        let usage;
        let importedName;
        const localName = specifier.local.name;
        const commons = [
          getReboostResolveCall(path.node.source.value),
          t.stringLiteral(filePath)
        ];

        if (t.isImportDefaultSpecifier(specifier)) {
          usage = 'Default';
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          usage = 'All';
        } else if (t.isImportSpecifier(specifier)) {
          usage = 'Member';
          importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
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

      (replacements || (replacements = [])).push([
        path,
        t.importDeclaration([
          t.importNamespaceSpecifier(identifier)
        ], t.stringLiteral(path.node.source.value)),
        declarators
      ]);
    },
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'require' }) &&
        path.node.arguments.length === 1 &&
        t.isStringLiteral(path.node.arguments[0]) &&
        !path.scope.hasBinding('require')
      ) {
        const importPath = path.node.arguments[0].value;
        const importIdentifier = (importIdentifierMap || (importIdentifierMap = {}))[importPath] ||
          t.identifier(`imported_${importIdx++}_${id}`);

        // Don't resolve built-in modules like path, fs, etc.
        if (builtinModules.includes(importPath)) return;

        if (!(importPath in importIdentifierMap)) {
          importIdentifierMap[importPath] = importIdentifier;
          (modImports || (modImports = [])).push(
            t.importDeclaration(
              [t.importNamespaceSpecifier(importIdentifier)],
              t.stringLiteral(importPath)
            )
          );
        }

        usedImporter = true;

        path.replaceWith(
          t.callExpression(
            t.memberExpression(
              importerIdentifier,
              t.identifier('All'),
            ),
            [
              importIdentifier,
              getReboostResolveCall(importPath),
              t.stringLiteral(filePath)
            ]
          )
        );
      }
    },
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
          'var',
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

  if (modImports) program.node.body.unshift(...modImports);

  if (usedImporter) {
    if (replacements) {
      replacements.forEach(([path, replacement, declarators]) => {
        if (declarators.length) {
          path.insertAfter(t.variableDeclaration('const', declarators));
        }
        path.replaceWith(replacement);
      });
    }

    program.node.body.unshift(
      t.importDeclaration([
        t.importDefaultSpecifier(importerIdentifier)
      ], t.stringLiteral('#/importer'))
    );
  }
}
