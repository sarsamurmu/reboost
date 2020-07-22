import chalk from 'chalk';
import traverse, { NodePath } from '@babel/traverse';
import * as babelTypes from '@babel/types';

import { getPluginHooks } from './processor';
import { getAddress } from '../shared';
import { toPosix } from '../utils';

export const resolveImports = async (ast: babelTypes.Node, filePath: string, imports: string[]) => {
  let error = false;

  const resolvePath = async (source: string, filePath: string) => {
    for (const hook of getPluginHooks().resolveHooks) {
      const resolvedPath = await hook(source, filePath);
      if (resolvedPath) return resolvedPath;
    }
    console.log(chalk.red(`[reboost] Unable to resolve path "${source}" of "${filePath}"`));
    return null;
  }

  const resolveDeclaration = async (astPath: NodePath<babelTypes.ImportDeclaration> | NodePath<babelTypes.ExportDeclaration>) => {
    if ((astPath.node as any).source) {
      const source: string = (astPath.node as any).source.value;

      if (source === 'reboost/hmr') {
        (astPath.node as any).source.value = `/hmr?q=${encodeURI(filePath)}`;
      } else {
        let finalPath = null;
        let routed = false;
        if (source.startsWith('#/')) {
          finalPath = source.replace(/^#/, '');
          routed = true;
        } else {
          const resolvedPath = await resolvePath(source, filePath);
          if (resolvedPath) {
            if (resolvedPath.startsWith('#/')) {
              finalPath = resolvedPath.replace(/^#/, '');
              routed = true;
            } else {
              finalPath = toPosix(resolvedPath);
              imports.push(finalPath);
            }
          } else {
            error = true;
          }
        }

        (astPath.node as any).source.value = getAddress() + (routed
          ? encodeURI(finalPath)
          : finalPath
            ? `/transformed?q=${encodeURI(finalPath)}`
            : `/unresolved?import=${encodeURI(source)}`);
      }
    }
  }

  const promiseExecutors: (() => Promise<void>)[] = [];
  let astProgram: NodePath<babelTypes.Program>;

  traverse(ast, {
    Program(astPath) {
      astProgram = astPath;
    },
    ImportDeclaration(astPath) {
      promiseExecutors.push(async () => {
        await resolveDeclaration(astPath);
      });
      return false;
    },
    ExportDeclaration(astPath) {
      promiseExecutors.push(async () => {
        await resolveDeclaration(astPath);
      });
      return false;
    },
    CallExpression(astPath) {
      const t = babelTypes;
      if (t.isIdentifier(astPath.node.callee, { name: '__reboost_resolve' })) {
        promiseExecutors.push(async () => {
          astPath.replaceWith(
            t.stringLiteral(
              await resolvePath((astPath.node.arguments[0] as babelTypes.StringLiteral).value, filePath)
            )
          );
        });
      } else if (t.isImport(astPath.node.callee)) {
        // Rewrite dynamic imports
        const importDeclarations = astProgram.get('body').filter((p) => p.isImportDeclaration());
        let importerDeclaration = importDeclarations.find(
          (dec) => (dec as NodePath<babelTypes.ImportDeclaration>).node.source.value.includes('#/importer')
        ).node as babelTypes.ImportDeclaration;
        if (!importerDeclaration) {
          const identifier = astPath.scope.generateUidIdentifier('$importer');
          importerDeclaration = t.importDeclaration([
            t.importDefaultSpecifier(identifier)
          ], t.stringLiteral('#/importer'));
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
              t.stringLiteral((astPath.node.arguments[0] as babelTypes.StringLiteral).value),
              t.stringLiteral(filePath)
            ]
          )
        );
      }
    }
  });

  for (const execute of promiseExecutors) await execute();

  return error;
}
