import { NodePath, types as t, builders as b, is } from 'estree-toolkit';

import { builtinModules } from 'module';

const getReboostResolveCall = (source: string) => b.callExpression(
  b.identifier('__reboost_resolve'),
  [b.literal(source)]
);

export const transformCommonJS = (programPath: NodePath<t.Program>, filePath: string, id: string) => {
  let usedModuleExports: boolean;
  let usedExports: boolean;
  let modImports: t.ImportDeclaration[];
  let importIdentifierMap: Record<string, t.Identifier>;
  const importerIdentifier: t.Identifier = b.identifier(`importer_${id}`);
  let usedImporter: boolean;
  let replacements: [NodePath<t.ImportDeclaration>, t.ImportDeclaration, t.VariableDeclarator[]][];
  let importIdx = 0;

  programPath.traverse({
    Program(path) {
      if (path.scope.hasGlobalBinding('module')) usedModuleExports = true;
      if (path.scope.hasGlobalBinding('exports')) usedExports = true;
    },
    ImportDeclaration(path) {
      if (path.node.specifiers.length === 0) return;

      const declarators: t.VariableDeclarator[] = [];
      const identifier = b.identifier(`import_${importIdx++}_${id}`);

      usedImporter = true;

      path.node.specifiers.forEach((specifier) => {
        let usage;
        let importedName;
        const localName = specifier.local.name;
        const commons = [
          getReboostResolveCall(path.node.source.value as string),
          b.literal(filePath)
        ];

        if (is.importDefaultSpecifier(specifier)) {
          usage = 'Default';
        } else if (is.importNamespaceSpecifier(specifier)) {
          usage = 'All';
        } else if (is.importSpecifier(specifier)) {
          usage = 'Member';
          importedName = specifier.imported.name;
        }

        declarators.push(
          b.variableDeclarator(
            b.identifier(localName),
            b.callExpression(
              b.memberExpression(
                importerIdentifier,
                b.identifier(usage)
              ),
              importedName ? [
                identifier,
                b.literal(importedName),
                ...commons
              ] : [identifier, ...commons]
            )
          )
        );
      });

      (replacements ||= []).push([
        path,
        b.importDeclaration([
          b.importNamespaceSpecifier(identifier)
        ], b.literal(path.node.source.value)),
        declarators
      ]);
    },
    CallExpression(path) {
      if (
        is.identifier(path.node.callee, { name: 'require' }) &&
        path.node.arguments.length === 1 &&
        is.literal(path.node.arguments[0], { value: (v) => typeof v === 'string' }) &&
        !path.scope.hasBinding('require')
      ) {
        const importPath = path.node.arguments[0].value as string;
        const importIdentifier = (importIdentifierMap ||= {})[importPath] ||
          b.identifier(`imported_${importIdx++}_${id}`);

        // Don't resolve built-in modules like path, fs, etc.
        if (builtinModules.includes(importPath)) return;

        if (!(importPath in importIdentifierMap)) {
          importIdentifierMap[importPath] = importIdentifier;
          (modImports ||= []).push(
            b.importDeclaration(
              [b.importNamespaceSpecifier(importIdentifier)],
              b.literal(importPath)
            )
          );
        }

        usedImporter = true;

        path.replaceWith(
          b.callExpression(
            b.memberExpression(
              importerIdentifier,
              b.identifier('All'),
            ),
            [
              importIdentifier,
              getReboostResolveCall(importPath),
              b.literal(filePath)
            ]
          )
        );
      }
    }
  });

  if (usedModuleExports || usedExports) {
    if (usedModuleExports) {
      programPath.unshiftContainer('body', [
        b.variableDeclaration(
          'const',
          [
            b.variableDeclarator(
              b.identifier('module'),
              b.objectExpression([
                b.property(
                  'init',
                  b.identifier('exports'),
                  usedExports ? b.identifier('exports') : b.objectExpression([]),
                  false,
                  usedExports
                )
              ])
            ),
          ]
        )
      ]);
    }

    if (usedExports) {
      programPath.unshiftContainer('body', [
        b.variableDeclaration(
          'const',
          [
            b.variableDeclarator(
              b.identifier('exports'),
              b.objectExpression([])
            )
          ]
        )
      ]);
    }

    programPath.pushContainer('body', [
      b.exportNamedDeclaration(
        b.variableDeclaration(
          'var',
          [
            b.variableDeclarator(
              b.identifier('__cjsExports'),
              usedModuleExports
                ? b.memberExpression(b.identifier('module'), b.identifier('exports'))
                : b.identifier('exports')
            )
          ]
        )
      )
    ]);
  }

  if (modImports) programPath.unshiftContainer('body', modImports);

  if (usedImporter) {
    if (replacements) {
      replacements.forEach(([path, replacement, declarators]) => {
        if (declarators.length) {
          path.insertAfter([b.variableDeclaration('const', declarators)]);
        }
        path.replaceWith(replacement);
      });
    }

    programPath.unshiftContainer('body', [
      b.importDeclaration([
        b.importDefaultSpecifier(importerIdentifier)
      ], b.literal('#/importer'))
    ]);
  }
}
