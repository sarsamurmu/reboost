import * as t from '@babel/types';
import traverse, { NodePath, Scope } from '@babel/traverse';

import { builtinModules } from 'module';

import { uniqueID } from '../../utils';

const isRequireFunc = (node: t.CallExpression, scope: Scope) => (
  t.isIdentifier(node.callee, { name: 'require' }) &&
  node.arguments.length === 1 &&
  t.isStringLiteral(node.arguments[0]) &&
  !scope.hasBinding('require')
);

const isModuleExports = (node: t.MemberExpression, scope: Scope) => (
  t.isIdentifier(node.object, { name: 'module' }) &&
  (
    node.computed
      ? t.isStringLiteral(node.property, { value: 'exports' })
      : t.isIdentifier(node.property, { name: 'exports' })
  ) &&
  !scope.hasBinding('module')
);

const cjsModuleTrue = () => t.exportNamedDeclaration(
  t.variableDeclaration(
    'const',
    [t.variableDeclarator(t.identifier('__cjsModule'), t.booleanLiteral(true))]
  )
);

export const transformCommonJSToES6 = (ast: t.Node) => {
  const id = uniqueID(6);
  const insertAfters: [NodePath, t.Node][] = [];
  const modImports: t.ImportDeclaration[] = [];
  const modExports: t.ExportSpecifier[] = [];
  const importIdentifierMap: Record<string, t.Identifier> = {};
  const exportAlls: t.ExportAllDeclaration[] = [];
  const exportIdentifierMap: Record<string, t.Identifier> = {};
  const toRemove: NodePath[] = [];
  const importerIdentifier = t.identifier(`importer_${id}`);
  let program: NodePath<t.Program>;
  // If `exports.<member> = value;` is used
  let usedExports = false;
  // If `module.exports.<member> = value;` is used
  let usedModuleExports = false;
  // If `require()` function is used
  let usedRequire = false;
  let importIdx = 0;
  let exportIdx = 0;

  traverse(ast, {
    Program(path) {
      program = path;
    },
    CallExpression(path) {
      if (isRequireFunc(path.node, path.scope)) {
        const parentPath = path.parentPath;
        if (
          t.isAssignmentExpression(parentPath.node) &&
          t.isMemberExpression(parentPath.node.left) &&
          isModuleExports(parentPath.node.left, parentPath.scope)
        ) return;

        const importPath = (path.node.arguments[0] as t.StringLiteral).value;
        const importIdentifier = importIdentifierMap[importPath] || t.identifier(`imported_${importIdx++}_${id}`);

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

        path.replaceWith(
          t.callExpression(
            t.memberExpression(importerIdentifier, t.identifier('require')),
            [importIdentifier]
          )
        );

        usedRequire = true;
      }
    },
    MemberExpression(path) {
      const parent = path.parentPath;
      let exportIdentifier;
      let exportName;
      let usedExportType: 'module.exports' | 'exports';

      if (isModuleExports(path.node, path.scope)) {
        const markUsedModuleExports = () => {
          usedModuleExports = true;
          usedExportType = 'module.exports';
        }

        if (t.isMemberExpression(parent.node)) {
          // module.exports.any
          exportName = (parent.node.property as t.Identifier).name ||
            (parent.node.property as t.StringLiteral).value;

          markUsedModuleExports();
        } else if (
          t.isAssignmentExpression(parent.node) &&
          (
            t.isProgram(parent.parentPath) ||
            (
              t.isExpressionStatement(parent.parentPath) &&
              t.isProgram(parent.parentPath.parentPath)
            )
          ) &&
          t.isCallExpression(parent.node.right) &&
          isRequireFunc(parent.node.right, parent.scope)
        ) {
          // module.exports = require('some/code');
          exportAlls.push(
            t.exportAllDeclaration(
              t.stringLiteral((parent.node.right.arguments[0] as t.StringLiteral).value)
            )
          );

          toRemove.push(parent);
        } else {
          markUsedModuleExports();
        }
      } else if (
        t.isIdentifier(path.node.object, { name: 'exports' }) &&
        !path.scope.hasBinding('exports')
      ) {
        exportName = (path.node.property as t.Identifier).name;

        usedExports = true;
        usedExportType = 'exports';
      }

      if (
        exportName &&
        /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(exportName)
      ) {
        exportIdentifier = exportIdentifierMap[exportName] || t.identifier(`export_${exportIdx++}_${id}`);

        insertAfters.push([
          path.findParent((p) => p.isExpressionStatement()),
          t.expressionStatement(
            t.assignmentExpression(
              '=',
              exportIdentifier,
              t.memberExpression(
                usedExportType === 'module.exports'
                  ? t.memberExpression(t.identifier('module'), t.identifier('exports'))
                  : t.identifier('exports'),
                t.identifier(exportName)
              )
            )
          )
        ]);

        if (!(exportName in exportIdentifierMap)) {
          exportIdentifierMap[exportName] = exportIdentifier;
          modExports.push(
            t.exportSpecifier(exportIdentifier, t.identifier(exportName))
          );
        }
      }
    },
  });

  const hasOtherExports = program.get('body').some((p) => p.isExportDeclaration());

  insertAfters.forEach(([path, toInsert]) => path && path.insertAfter(toInsert));
  toRemove.forEach((path) => path.remove());

  const exportIdentifiers = Object.values(exportIdentifierMap);
  if (exportIdentifiers.length) {
    program.node.body.unshift(
      t.variableDeclaration(
        'let',
        exportIdentifiers.map((name) => t.variableDeclarator(name))
      )
    );
  }

  if (exportAlls.length > 1 && !('default' in exportIdentifierMap)) {
    const array: [t.Identifier, t.StringLiteral][] = [];
    const expressions: t.ExpressionStatement[] = [];
    const exportsObj = usedModuleExports
      ? t.memberExpression(t.identifier('module'), t.identifier('exports'))
      : usedExports
        ? t.identifier('exports')
        : t.identifier(`all_exports_obj_${id}`);
    let idx = 0;

    exportAlls.forEach((exp) => {
      array.push([t.identifier(`all_imports_${idx++}_${id}`), exp.source]);
    });

    array.forEach(([identifier, source]) => {
      modImports.push(
        t.importDeclaration(
          [t.importNamespaceSpecifier(identifier)],
          source
        )
      );

      expressions.push(
        t.expressionStatement(
          t.callExpression(
            t.memberExpression(
              t.identifier('Object'),
              t.identifier('assign')
            ),
            [
              exportsObj,
              t.objectExpression([
                t.spreadElement(identifier),
                t.spreadElement(exportsObj)
              ])
            ]
          )
        )
      );
    });

    program.node.body.unshift(...expressions);

    if (!usedModuleExports && !usedExports) {
      program.node.body.unshift(
        t.variableDeclaration(
          'const',
          [t.variableDeclarator(exportsObj, t.objectExpression([]))]
        )
      );

      program.node.body.push(
        t.exportDefaultDeclaration(exportsObj),
        cjsModuleTrue()
      );
    }
  }

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
          )
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

  program.node.body.unshift(...modImports);
  if (modExports.length) program.node.body.push(t.exportNamedDeclaration(null, modExports));
  program.node.body.push(...exportAlls);

  if (
    !usedModuleExports && !usedExports &&
    exportAlls.length === 1 && modExports.length === 0 && !hasOtherExports
  ) {
    const namespaceIdentifier = t.identifier(`for_default_${id}`);
    const defaultExportIdentifier = t.identifier(`default_export_${id}`);
    program.node.body.unshift(
      t.importDeclaration(
        [t.importNamespaceSpecifier(namespaceIdentifier)],
        exportAlls[0].source
      ),
      t.variableDeclaration(
        'let',
        [t.variableDeclarator(defaultExportIdentifier)]
      )
    );
    program.node.body.push(
      t.ifStatement(
        t.binaryExpression(
          'in',
          t.stringLiteral('default'),
          namespaceIdentifier
        ),
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            defaultExportIdentifier,
            t.memberExpression(
              namespaceIdentifier,
              t.stringLiteral('default'),
              true
            )
          )
        )
      ),
      t.exportDefaultDeclaration(defaultExportIdentifier)
    );
  }

  if (!('default' in exportIdentifierMap) && (usedModuleExports || usedExports)) {
    program.node.body.push(
      t.exportDefaultDeclaration(
        usedModuleExports
          ? t.memberExpression(t.identifier('module'), t.identifier('exports'))
          : t.identifier('exports')
      ),
      cjsModuleTrue()
    )
  }

  if (usedRequire) {
    program.node.body.unshift(
      t.importDeclaration([
        t.importDefaultSpecifier(importerIdentifier)
      ], t.stringLiteral('#/importer'))
    );
  }
}
