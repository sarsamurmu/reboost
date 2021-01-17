import { NodePath, types as t, builders as b, utils as u, is, Scope } from 'estree-toolkit';

import { builtinModules } from 'module';

const hasProp = (prop: string, obj: Record<string, unknown>) => (
  Object.prototype.hasOwnProperty.call(obj, prop)
)

const isRequireFunc = (node: t.CallExpression, scope: Scope) => (
  is.identifier(node.callee, { name: 'require' }) &&
  node.arguments.length === 1 &&
  is.literal(node.arguments[0], { value: (v) => typeof v === 'string' }) &&
  !scope.hasBinding('require')
);

const isModuleExports = (node: t.MemberExpression, scope: Scope) => (
  is.identifier(node.object, { name: 'module' }) &&
  (
    node.computed
      ? is.literal(node.property, { value: 'exports' })
      : is.identifier(node.property, { name: 'exports' })
  ) &&
  !scope.hasBinding('module')
);

const export__cjsModuleTrue = () => b.exportNamedDeclaration(
  b.variableDeclaration(
    'const',
    [b.variableDeclarator(b.identifier('__cjsModule'), b.literal(true))]
  )
);

export const transformCommonJSToES6 = (programPath: NodePath<t.Program>, id: string) => {
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
  // If `exports.<member> = value;` is used
  let usedExports: boolean;
  // If `module.exports.<member> = value;` is used
  let usedModuleExports: boolean;
  let is__esModule: boolean;

  const fixRequireCallExpression = (path: NodePath<t.CallExpression>) => {
    const importPath = (path.node.arguments[0] as t.Literal).value as string;
    const importIdentifier = (importIdentifierMap ||= {})[importPath] ||
      b.identifier(`imported_${importIdx++}_${id}`);

    // Don't resolve built-in modules like path, fs, etc.
    if (builtinModules.includes(importPath)) return;

    if (!hasProp(importPath, importIdentifierMap)) {
      importIdentifierMap[importPath] = importIdentifier;
      (modImports ||= []).push(
        b.importDeclaration(
          [b.importNamespaceSpecifier(importIdentifier)],
          b.literal(importPath)
        )
      );
    }

    path.replaceWith(
      b.callExpression(
        (interopFuncIdentifier ||= b.identifier(`__commonJS_${id}`)),
        [importIdentifier]
      )
    );
  }

  programPath.traverse({
    CallExpression(path) {
      if (isRequireFunc(path.node, path.scope)) {
        const parentPath = path.parentPath;
        if (
          is.assignmentExpression(parentPath.node) &&
          is.memberExpression(parentPath.node.left) &&
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
      const { parentPath } = path;
      let exportIdentifier: t.Identifier;
      let exportName: string;
      let usedExportType: 'module.exports' | 'exports';

      if (
        is.callExpression(parentPath) &&
        is.identifier(path.node.object, { name: 'Object' }) &&
        is.identifier(path.node.property, { name: 'defineProperty' }) &&
        (
          (
            is.identifier(parentPath.node.arguments[0], { name: 'exports' }) &&
            !parentPath.scope.hasBinding('exports')
          ) || (
            is.memberExpression(parentPath.node.arguments[0]) &&
            isModuleExports(parentPath.node.arguments[0], parentPath.scope)
          )
        ) &&
        is.literal(parentPath.node.arguments[1], { value: '__esModule' }) &&
        is.objectExpression(parentPath.node.arguments[2]) &&
        parentPath.node.arguments[2].properties.some((n) => (
          is.property(n) &&
          is.identifier(n.key, { name: 'value' }) &&
          is.literal(n.value, { value: true }) &&
          !n.computed && !n.shorthand
        ))
      ) {
        // Object.defineProperty(exports, '__esModule', { value: true });
        // Object.defineProperty(module.exports, '__esModule', { value: true });

        is__esModule = true;
        parentPath.remove();
        return;
      }

      if (isModuleExports(path.node, path.scope)) {
        const markUsedModuleExports = () => {
          usedModuleExports = true;
          usedExportType = 'module.exports';
        }

        if (
          is.memberExpression(parentPath.node) &&
          (
            parentPath.node.computed
              ? is.literal(parentPath.node.property, { value: (v) => typeof v === 'string' })
              : true
          )
        ) {
          // module.exports.any
          exportName = (parentPath.node.property as t.Identifier).name ||
            (parentPath.node.property as t.Literal).value as string;

          if (
            exportName === '__esModule' &&
            is.assignmentExpression(parentPath.parentPath) &&
            u.evaluateTruthy(parentPath.parentPath.get('right'))
          ) {
            // module.exports.__esModule = <truthyValue>;
            is__esModule = true;
          }

          markUsedModuleExports();
        } else if (
          is.assignmentExpression(parentPath) &&
          (
            is.program(parentPath.parentPath) ||
            (
              is.expressionStatement(parentPath.parentPath) &&
              is.program(parentPath.parentPath.parentPath)
            )
          ) &&
          is.callExpression(parentPath.node.right) &&
          isRequireFunc(parentPath.node.right, parentPath.scope)
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
          exportAll = b.exportAllDeclaration(
            b.literal((parentPath.node.right.arguments[0] as t.Literal).value)
          );
          exportAllParent = parentPath;

          // Reset previous exports
          exportIdx = 0;
          exportIdentifierMap = null;
          modExports = null;
          insertAfters = null;
        } else {
          markUsedModuleExports();
        }
      } else if (
        is.identifier(path.node.object, { name: 'exports' }) &&
        !path.scope.hasBinding('exports')
      ) {
        exportName = (path.node.property as t.Identifier).name ||
          (path.node.property as t.Literal).value as string;

        if (
          exportName === '__esModule' &&
          is.assignmentExpression(parentPath) &&
          u.evaluateTruthy(parentPath.get('right'))
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
        exportIdentifier = (exportIdentifierMap ||= {})[exportName] ||
          b.identifier(`export_${exportIdx++}_${id}`);

        (insertAfters ||= []).push([
          path.findParent((p) => is.expressionStatement(p)),
          b.expressionStatement(
            b.assignmentExpression(
              '=',
              exportIdentifier,
              b.memberExpression(
                usedExportType === 'module.exports'
                  ? b.memberExpression(b.identifier('module'), b.identifier('exports'))
                  : b.identifier('exports'),
                b.identifier(exportName)
              )
            )
          )
        ]);

        if (!hasProp(exportName, exportIdentifierMap)) {
          exportIdentifierMap[exportName] = exportIdentifier;
          (modExports ||= []).push(
            b.exportSpecifier(exportIdentifier, b.identifier(exportName))
          );
        }
      }
    },
  });

  const hasOtherExports = programPath.get('body').some((p: NodePath) => is.exportDeclaration(p));

  if (insertAfters) insertAfters.forEach(([path, toInsert]) => path && path.insertAfter([toInsert]));

  if (exportAll) {
    if (exportIdentifierMap) {
      fixRequireCallExpression(exportAllParent.get<t.CallExpression>('right'));
    } else {
      exportAllParent.remove();
    }
  }

  if (exportIdentifierMap) {
    const exportIdentifiers = Object.values(exportIdentifierMap);
    programPath.unshiftContainer('body', [
      b.variableDeclaration(
        'let',
        exportIdentifiers.map((name) => b.variableDeclarator(name))
      )
    ]);
  }

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
          )
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

  if (modImports) programPath.unshiftContainer('body', modImports);
  if (modExports) programPath.pushContainer('body', [b.exportNamedDeclaration(null, modExports)]);
  if (exportAll) programPath.pushContainer('body', [exportAll]);

  const shouldExportDefaultFromExportAll = !exportIdentifierMap && exportAll &&
    !is__esModule && !modExports && !hasOtherExports;

  if (shouldExportDefaultFromExportAll) {
    const namespaceIdentifier = b.identifier(`for_default_${id}`);
    const defaultExportIdentifier = b.identifier(`default_export_${id}`);
    programPath.unshiftContainer('body', [
      b.importDeclaration(
        [b.importNamespaceSpecifier(namespaceIdentifier)],
        b.literal(exportAll.source.value)
      ),
      b.variableDeclaration(
        'let',
        [b.variableDeclarator(defaultExportIdentifier)]
      )
    ]);
    programPath.pushContainer('body', [
      b.ifStatement(
        b.binaryExpression(
          'in',
          b.literal('default'),
          namespaceIdentifier
        ),
        b.expressionStatement(
          b.assignmentExpression(
            '=',
            defaultExportIdentifier,
            b.memberExpression(
              namespaceIdentifier,
              b.literal('default'),
              true
            )
          )
        )
      ),
      b.exportDefaultDeclaration(defaultExportIdentifier)
    ]);
  }

  if (
    /* Not exporting default if default is already exported --> */ !shouldExportDefaultFromExportAll &&
    (exportIdentifierMap ? !hasProp('default', exportIdentifierMap) : true) &&
    !is__esModule && (usedModuleExports || usedExports)
  ) {
    programPath.pushContainer('body', [
      b.exportDefaultDeclaration(
        usedModuleExports
          ? b.memberExpression(b.identifier('module'), b.identifier('exports'))
          : b.identifier('exports')
      ),
      export__cjsModuleTrue()
    ]);
  }

  if (interopFuncIdentifier) {
    programPath.unshiftContainer('body', [
      b.variableDeclaration(
        'const',
        [
          b.variableDeclarator(
            interopFuncIdentifier,
            b.arrowFunctionExpression(
              [b.identifier('mod')],
              b.conditionalExpression(
                b.memberExpression(b.identifier('mod'), b.identifier('__cjsModule')),
                b.memberExpression(b.identifier('mod'), b.literal('default'), true),
                b.identifier('mod')
              )
            )
          )
        ]
      )
    ]);
  }
}
