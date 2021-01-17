import chalk from 'chalk';
import { NodePath, types as t, builders as b, is } from 'estree-toolkit';

import { ReboostInstance } from '../index';
import { getPluginHooks } from './processor';
import { uniqueID } from '../utils';

export const resolveDependency = async (
  instance: ReboostInstance,
  pathToResolve: string,
  relativeTo: string
) => {
  for (const hook of getPluginHooks(instance).resolveHooks) {
    const resolvedPath = await hook(pathToResolve, relativeTo);
    if (resolvedPath) return resolvedPath;
  }

  instance.log('info', chalk.red(`Unable to resolve path "${pathToResolve}" of "${relativeTo}"`));
  return null;
}

const isPathRouted = (path: string) => path.startsWith('#/');
const pathFromRouted = (path: string) => path.substring(1);

export const resolveImports = async (
  instance: ReboostInstance,
  programPath: NodePath<t.Program>,
  filePath: string
) => {
  let error = false;
  const imports: string[] = [];

  const resolveDeclaration = async (
    nodePath: NodePath<t.ImportDeclaration | t.ExportDeclaration>
  ): Promise<void> => {
    if (nodePath.has('source')) {
      const sourcePath = nodePath.get<t.Literal>('source');
      const source = sourcePath.node.value as string;

      if (source === 'reboost/hmr' || source === 'reboost/hot') {
        // TODO: Remove it in v1.0
        if (source === 'reboost/hmr') {
          instance.log('info', chalk.yellow(`Warning ${filePath}: "reboost/hmr" is deprecated, please use "reboost/hot"`));
        }

        sourcePath.replaceWith(b.literal(`/hot?q=${encodeURIComponent(filePath)}`));
      } else {
        let finalPath = null;
        let routed = false;
        if (isPathRouted(source)) {
          finalPath = pathFromRouted(source);
          routed = true;
        } else {
          const resolvedPath = await resolveDependency(instance, source, filePath);
          if (resolvedPath) {
            if (isPathRouted(resolvedPath)) {
              finalPath = pathFromRouted(resolvedPath);
              routed = true;
            } else {
              finalPath = resolvedPath;
              imports.push(finalPath);
            }
          } else {
            error = true;
          }
        }

        sourcePath.replaceWith(b.literal(
          routed
            ? finalPath
            : finalPath
              ? `/transformed?q=${encodeURIComponent(finalPath)}`
              : `/unresolved?import=${encodeURIComponent(source)}&importer=${encodeURIComponent(filePath)}`
        ));
      }
    }
  }

  const promiseExecutors: (() => Promise<void>)[] = [];
  let hasImportMeta = false;

  programPath.traverse({
    ImportDeclaration(path) {
      promiseExecutors.push(() => resolveDeclaration(path));
    },
    ExportDeclaration(path) {
      promiseExecutors.push(() => resolveDeclaration(path));
    },
    CallExpression(path) {
      if (is.identifier(path.node.callee, { name: '__reboost_resolve' })) {
        promiseExecutors.push(async () => {
          const toResolve = (path.node.arguments[0] as t.Literal).value as string;
          if (isPathRouted(toResolve)) {
            path.replaceWith(b.literal(pathFromRouted(toResolve)));
          } else {
            const resolvedPath = await resolveDependency(instance, toResolve, filePath);
            if (resolvedPath) {
              path.replaceWith(b.literal(resolvedPath));
            }
          }
        });
      }
    },
    ImportExpression(path) {
      // Rewrite dynamic imports
      const importerIdentifier = b.identifier(`importer_${uniqueID(6)}`);
      const importerDeclaration = b.importDeclaration([
        b.importDefaultSpecifier(importerIdentifier)
      ], b.literal('/importer'));
      programPath.unshiftContainer('body', [importerDeclaration])[0].skip(); // Don't traverse the import declaration

      path.replaceWith(
        b.callExpression(
          b.memberExpression(
            b.identifier(importerIdentifier.name),
            b.identifier('Dynamic')
          ),
          [
            path.node.source,
            b.literal(filePath)
          ]
        )
      );
    },
    MetaProperty(path) {
      if (
        is.identifier(path.node.meta, { name: 'import' }) &&
        is.identifier(path.node.property, { name: 'meta' })
      ) {
        hasImportMeta = true;
      }
    }
  });

  if (hasImportMeta) {
    const importMeta = b.metaProperty(
      b.identifier('import'),
      b.identifier('meta')
    );
    const importMetaUrl = b.memberExpression(
      importMeta,
      b.identifier('url')
    );
    const localHotIdentifier = b.identifier('Hot_' + uniqueID(4));

    programPath.unshiftContainer('body', [
      b.importDeclaration(
        [b.importSpecifier(b.identifier('Hot'), localHotIdentifier)],
        b.literal('/runtime')
      ),

      b.expressionStatement(
        b.assignmentExpression(
          '=',
          b.memberExpression(
            importMeta,
            b.identifier('reboost')
          ),
          b.literal(true)
        )
      ),

      b.expressionStatement(
        b.assignmentExpression(
          '=',
          b.memberExpression(
            importMeta,
            b.identifier('absoluteUrl')
          ),
          importMetaUrl
        )
      ),

      b.expressionStatement(
        b.assignmentExpression(
          '=',
          importMetaUrl,
          b.literal(filePath)
        )
      ),

      b.expressionStatement(
        b.assignmentExpression(
          '=',
          b.memberExpression(
            importMeta,
            b.identifier('hot')
          ),
          b.newExpression(
            localHotIdentifier,
            [b.literal(filePath)]
          )
        )
      )
    ]);
  }

  for (const execute of promiseExecutors) await execute();

  if (imports.length) {
    programPath.pushContainer('body', [
      b.expressionStatement(
        b.callExpression(
          b.memberExpression(
            b.memberExpression(b.identifier('Reboost'), b.literal('[[Private]]'), true),
            b.identifier('setDependencies')
          ),
          [
            b.literal(filePath),
            b.arrayExpression(imports.map((s) => b.literal(s)))
          ]
        )
      )
    ]);
  }

  return error;
}
