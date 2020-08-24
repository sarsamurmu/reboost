import * as t from '@babel/types';
import traverse, { NodePath, Scope } from '@babel/traverse';

import { builtinModules } from 'module';

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

const export__cjsModuleTrue = () => t.exportNamedDeclaration(
  t.variableDeclaration(
    'const',
    [t.variableDeclarator(t.identifier('__cjsModule'), t.booleanLiteral(true))]
  )
);

export const transformCommonJSToES6 = (ast: t.Node, id: string) => {
  // Most of variables are initialized lazily
  let importIdx = 0;
  let importIdentifierMap: Record<string, t.Identifier>;
  let modImports: t.ImportDeclaration[];
  let exportIdx = 0;
  let exportIdentifierMap: Record<string, t.Identifier>;
  // There can be only one `export * from ''`
  let exportAll: t.ExportAllDeclaration;
  let exportAllParent: NodePath;
  let modExports: t.ExportSpecifier[];
  let insertAfters: [NodePath, t.Node][];
  let interopFuncIdentifier: t.Identifier;
  let program: NodePath<t.Program>;
  // If `exports.<member> = value;` is used
  let usedExports: boolean;
  // If `module.exports.<member> = value;` is used
  let usedModuleExports: boolean;
  let is__esModule: boolean;

  const fixRequireCallExpression = (path: NodePath<t.CallExpression>) => {
    const importPath = (path.node.arguments[0] as t.StringLiteral).value;
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

    path.replaceWith(
      t.callExpression(
        (interopFuncIdentifier || (interopFuncIdentifier = t.identifier(`__commonJS_${id}`))),
        [importIdentifier]
      )
    );
  }

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
        ) {
          // module.exports = require('something')
          // This is handled by the MemberExpression function
          return;
        }

        fixRequireCallExpression(path);
      }
    },
    MemberExpression(path) {
      const parent = path.parentPath;
      let exportIdentifier;
      let exportName;
      let usedExportType: 'module.exports' | 'exports';

      if (
        parent.isCallExpression() &&
        t.isIdentifier(path.node.object, { name: 'Object' }) &&
        t.isIdentifier(path.node.property, { name: 'defineProperty' }) &&
        (
          (
            t.isIdentifier(parent.node.arguments[0], { name: 'exports' }) &&
            !parent.scope.hasBinding('exports')
          ) || (
            t.isMemberExpression(parent.node.arguments[0]) &&
            isModuleExports(parent.node.arguments[0], parent.scope)
          )
        ) &&
        t.isStringLiteral(parent.node.arguments[1], { value: '__esModule' }) &&
        t.isObjectExpression(parent.node.arguments[2]) &&
        parent.node.arguments[2].properties.some((n) => (
          t.isObjectProperty(n) &&
          t.isIdentifier(n.key, { name: 'value' }) &&
          t.isBooleanLiteral(n.value, { value: true }) &&
          !n.computed && !n.shorthand
        ))
      ) {
        // Object.defineProperty(exports, '__esModule', { value: true });
        // Object.defineProperty(module.exports, '__esModule', { value: true });

        is__esModule = true;
        parent.remove();
        return;
      }

      if (isModuleExports(path.node, path.scope)) {
        const markUsedModuleExports = () => {
          usedModuleExports = true;
          usedExportType = 'module.exports';
        }

        if (
          t.isMemberExpression(parent.node) &&
          (parent.node.computed ? t.isStringLiteral(parent.node.property) : true)
        ) {
          // module.exports.any
          exportName = (parent.node.property as t.Identifier).name ||
            (parent.node.property as t.StringLiteral).value;

          if (
            exportName === '__esModule' &&
            parent.parentPath.isAssignmentExpression() &&
            (parent.parentPath.get('right') as NodePath).evaluateTruthy()
          ) {
            // module.exports.__esModule = <truthyValue>;
            is__esModule = true;
          }

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
          /*
            Code can be like this
            ```
            module.exports.item1 = 0;
            module.exports.item2 = 0;
            module.exports = require('some');
            ```
            Now `module.export.item{1,2}` are no longer available,
            this mean `module.exports = require()` basically resets other exports,
            so we are going to do the same
          */
          exportAll = t.exportAllDeclaration(
            t.stringLiteral((parent.node.right.arguments[0] as t.StringLiteral).value)
          );
          exportAllParent = parent;

          // Reset previous exports
          exportIdx = 0;
          exportIdentifierMap = undefined;
          modExports = undefined;
          insertAfters = undefined;
        } else {
          markUsedModuleExports();
        }
      } else if (
        t.isIdentifier(path.node.object, { name: 'exports' }) &&
        !path.scope.hasBinding('exports')
      ) {
        exportName = (path.node.property as t.Identifier).name ||
          (path.node.property as t.StringLiteral).value;

        if (
          exportName === '__esModule' &&
          path.parentPath.isAssignmentExpression() &&
          (path.parentPath.get('right') as NodePath).evaluateTruthy()
        ) {
          // exports.__esModule = <truthyValue>;
          is__esModule = true;
        }

        usedExports = true;
        usedExportType = 'exports';
      }

      if (
        exportName &&
        exportName !== '__esModule' &&
        /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(exportName)
      ) {
        exportIdentifier = (exportIdentifierMap || (exportIdentifierMap = {}))[exportName] ||
          t.identifier(`export_${exportIdx++}_${id}`);

        (insertAfters || (insertAfters = [])).push([
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
          (modExports || (modExports = [])).push(
            t.exportSpecifier(exportIdentifier, t.identifier(exportName))
          );
        }
      }
    },
  });

  const hasOtherExports = program.get('body').some((p) => p.isExportDeclaration());

  if (insertAfters) insertAfters.forEach(([path, toInsert]) => path && path.insertAfter(toInsert));

  if (exportAllParent) {
    if (exportIdentifierMap) {
      fixRequireCallExpression(exportAllParent.get('right') as NodePath<t.CallExpression>);
    } else {
      exportAllParent.remove();
    }
  }

  if (exportIdentifierMap) {
    const exportIdentifiers = Object.values(exportIdentifierMap);
    if (exportIdentifiers.length) {
      program.node.body.unshift(
        t.variableDeclaration(
          'let',
          exportIdentifiers.map((name) => t.variableDeclarator(name))
        )
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

  if (modImports) program.node.body.unshift(...modImports);
  if (modExports) program.node.body.push(t.exportNamedDeclaration(null, modExports));
  if (exportAll) program.node.body.push(exportAll);

  if (
    !exportIdentifierMap &&
    exportAll && !modExports && !hasOtherExports
  ) {
    const namespaceIdentifier = t.identifier(`for_default_${id}`);
    const defaultExportIdentifier = t.identifier(`default_export_${id}`);
    program.node.body.unshift(
      t.importDeclaration(
        [t.importNamespaceSpecifier(namespaceIdentifier)],
        exportAll.source
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

  if (
    exportIdentifierMap &&
    !('default' in exportIdentifierMap) &&
    !is__esModule &&
    (usedModuleExports || usedExports)
  ) {
    program.node.body.push(
      t.exportDefaultDeclaration(
        usedModuleExports
          ? t.memberExpression(t.identifier('module'), t.identifier('exports'))
          : t.identifier('exports')
      ),
      export__cjsModuleTrue()
    )
  }

  if (interopFuncIdentifier) {
    program.node.body.unshift(
      t.variableDeclaration(
        'const',
        [
          t.variableDeclarator(
            interopFuncIdentifier,
            t.arrowFunctionExpression(
              [t.identifier('mod')],
              t.conditionalExpression(
                t.memberExpression(t.identifier('mod'), t.identifier('__cjsModule')),
                t.memberExpression(t.identifier('mod'), t.stringLiteral('default'), true),
                t.identifier('mod')
              )
            )
          )
        ]
      )
    );
  }
}
