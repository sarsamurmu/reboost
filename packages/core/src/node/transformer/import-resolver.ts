import chalk from 'chalk';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { getPluginHooks } from './processor';
import { tLog, uniqueID } from '../utils';

export const resolveDependency = async (pathToResolve: string, relativeTo: string) => {
  for (const hook of getPluginHooks().resolveHooks) {
    const resolvedPath = await hook(pathToResolve, relativeTo);
    if (resolvedPath) return resolvedPath;
  }

  tLog('info', chalk.red(`Unable to resolve path "${pathToResolve}" of "${relativeTo}"`));
  return null;
}

export const resolveImports = async (ast: t.Node, filePath: string) => {
  let error = false;
  const imports: string[] = [];

  const resolveDeclaration = async (
    nodePath: NodePath<t.ImportDeclaration> | NodePath<t.ExportDeclaration>
  ): Promise<void> => {
    if (nodePath.has('source')) {
      const sourcePath = nodePath.get('source') as NodePath<t.StringLiteral>;
      const source: string = sourcePath.node.value;

      if (source === 'reboost/hmr' || source === 'reboost/hot') {
        // TODO: Remove it in v1.0
        if (source === 'reboost/hmr') {
          tLog('info', chalk.yellow(`Warning ${filePath}: "reboost/hmr" is deprecated, please use "reboost/hot"`));
        }

        sourcePath.replaceWith(t.stringLiteral(`/hot?q=${encodeURIComponent(filePath)}`));
      } else {
        let finalPath = null;
        let routed = false;
        if (source.startsWith('#/')) {
          finalPath = source.replace(/^#/, '');
          routed = true;
        } else {
          const resolvedPath = await resolveDependency(source, filePath);
          if (resolvedPath) {
            if (resolvedPath.startsWith('#/')) {
              finalPath = resolvedPath.replace(/^#/, '');
              routed = true;
            } else {
              finalPath = resolvedPath;
              imports.push(finalPath);
            }
          } else {
            error = true;
          }
        }

        sourcePath.replaceWith(t.stringLiteral(
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
  let astProgram: NodePath<t.Program>;

  traverse(ast, {
    Program(nodePath) {
      astProgram = nodePath;
    },
    ImportDeclaration(nodePath) {
      promiseExecutors.push(() => resolveDeclaration(nodePath));
      return false;
    },
    ExportDeclaration(nodePath) {
      promiseExecutors.push(() => resolveDeclaration(nodePath));
      return false;
    },
    CallExpression(nodePath) {
      if (t.isIdentifier(nodePath.node.callee, { name: '__reboost_resolve' })) {
        promiseExecutors.push(async () => {
          nodePath.replaceWith(
            t.stringLiteral(
              await resolveDependency((nodePath.node.arguments[0] as t.StringLiteral).value, filePath)
            )
          );
        });
      } else if (t.isImport(nodePath.node.callee)) {
        // Rewrite dynamic imports
        const importerIdentifier = nodePath.scope.generateUidIdentifier(`importer_${uniqueID(6)}`);
        const importerDeclaration = t.importDeclaration([
          t.importDefaultSpecifier(importerIdentifier)
        ], t.stringLiteral('/importer'));
        astProgram.node.body.unshift(importerDeclaration);
        
        nodePath.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.identifier(importerIdentifier.name),
              t.identifier('Dynamic')
            ),
            [
              nodePath.node.arguments[0],
              t.stringLiteral(filePath)
            ]
          )
        );
      }
    }
  });

  const importMeta = t.metaProperty(
    t.identifier('import'),
    t.identifier('meta')
  );
  const importMetaUrl = t.memberExpression(
    importMeta,
    t.identifier('url')
  );

  astProgram.node.body.unshift(
    t.expressionStatement(
      t.assignmentExpression(
        '=',
        importMetaUrl,
        t.stringLiteral(filePath)
      )
    )
  );

  astProgram.node.body.unshift(
    t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          importMeta,
          t.identifier('absoluteUrl')
        ),
        importMetaUrl
      )
    )
  );

  astProgram.node.body.unshift(
    t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          importMeta,
          t.identifier('reboost')
        ),
        t.booleanLiteral(true)
      )
    )
  );

  for (const execute of promiseExecutors) await execute();

  if (imports.length) {
    astProgram.node.body.push(
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier('Reboost'), t.stringLiteral('[[Private]]'), true),
            t.identifier('setDependencies')
          ),
          [
            t.stringLiteral(filePath),
            t.arrayExpression(imports.map((s) => t.stringLiteral(s)))
          ]
        )
      )
    );
  }

  return error;
}
