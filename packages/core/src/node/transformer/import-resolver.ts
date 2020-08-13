import chalk from 'chalk';
import traverse, { NodePath } from '@babel/traverse';
import * as babelTypes from '@babel/types';

import { getPluginHooks } from './processor';
import { getAddress } from '../shared';

export const resolveDependency = async (pathToResolve: string, relativeTo: string) => {
  for (const hook of getPluginHooks().resolveHooks) {
    const resolvedPath = await hook(pathToResolve, relativeTo);
    if (resolvedPath) return resolvedPath;
  }
  console.log(chalk.red(`[reboost] Unable to resolve path "${pathToResolve}" of "${relativeTo}"`));
  return null;
}

export const resolveImports = async (ast: babelTypes.Node, filePath: string, imports: string[]) => {
  let error = false;

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
              await resolveDependency((astPath.node.arguments[0] as babelTypes.StringLiteral).value, filePath)
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

  const t = babelTypes;
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
