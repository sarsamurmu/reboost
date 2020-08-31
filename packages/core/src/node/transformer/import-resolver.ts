import chalk from 'chalk';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { getPluginHooks } from './processor';
import { tLog } from '../utils';

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
    astPath: NodePath<t.ImportDeclaration> | NodePath<t.ExportDeclaration>
  ): Promise<void> => {
    const node = astPath.node as t.ImportDeclaration;
    if (node.source) {
      const source: string = node.source.value;

      if (source.startsWith('/')) return;

      if (source === 'reboost/hmr' || source === 'reboost/hot') {
        // TODO: Remove it in v1.0
        if (source === 'reboost/hmr') {
          tLog('info', chalk.yellow(`Warning ${filePath}: "reboost/hmr" is deprecated, please use "reboost/hot"`));
        }

        node.source.value = `/hot?q=${encodeURI(filePath)}`;
      } else {
        let finalPath = null;
        let routed = false;
        const resolvedPath = await resolveDependency(source, filePath);
        if (resolvedPath) {
          if (resolvedPath.startsWith('/')) {
            finalPath = resolvedPath.replace(/^#/, '');
            routed = true;
          } else {
            finalPath = resolvedPath;
            imports.push(finalPath);
          }
        } else {
          error = true;
        }

        node.source.value = routed
          ? finalPath
          : finalPath
            ? `/transformed?q=${encodeURI(finalPath)}`
            : `/unresolved?import=${encodeURI(source)}&importer=${encodeURI(filePath)}`;
      }
    }
  }

  const promiseExecutors: (() => Promise<void>)[] = [];
  let astProgram: NodePath<t.Program>;

  traverse(ast, {
    Program(astPath) {
      astProgram = astPath;
    },
    ImportDeclaration(astPath) {
      promiseExecutors.push(() => resolveDeclaration(astPath));
      return false;
    },
    ExportDeclaration(astPath) {
      promiseExecutors.push(() => resolveDeclaration(astPath));
      return false;
    },
    CallExpression(astPath) {
      if (t.isIdentifier(astPath.node.callee, { name: '__reboost_resolve' })) {
        promiseExecutors.push(async () => {
          astPath.replaceWith(
            t.stringLiteral(
              await resolveDependency((astPath.node.arguments[0] as t.StringLiteral).value, filePath)
            )
          );
        });
      } else if (t.isImport(astPath.node.callee)) {
        // Rewrite dynamic imports
        const importDeclarations = astProgram.get('body').filter((p) => p.isImportDeclaration()) as NodePath<t.ImportDeclaration>[];
        let importerDeclaration = (importDeclarations.find(
          ({ node }) => node.source.value.includes('/importer')
        ) || {}).node as t.ImportDeclaration;

        if (!importerDeclaration) {
          const identifier = astPath.scope.generateUidIdentifier('$importer');
          importerDeclaration = t.importDeclaration([
            t.importDefaultSpecifier(identifier)
          ], t.stringLiteral('/importer'));
          astProgram.node.body.unshift(importerDeclaration);
        }
        
        const importerIdentifierName = importerDeclaration.specifiers[0].local.name;
        astPath.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.identifier(importerIdentifierName),
              t.identifier('Dynamic')
            ),
            [
              astPath.node.arguments[0],
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
