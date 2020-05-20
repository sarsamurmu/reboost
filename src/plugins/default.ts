import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from '../index';
import { getConfig } from '../shared';
import { isDir, uniqueID } from '../utils';

const resolveExt = (fPath: string) => {
  for (const ext of getConfig().resolve.extensions) {
    if (fs.existsSync(fPath + ext)) return ext;
  }
  return null;
}

const baseResolve = (fPath: string) => {
  if (fs.existsSync(fPath) && isDir(fPath)) {
    for (const mainFile of getConfig().resolve.mainFiles) {
      const dirPath = path.join(fPath, mainFile);
      const ext = resolveExt(dirPath);
      if (ext) return dirPath + ext;
    }
  }
  
  const ext = resolveExt(fPath);
  if (ext) return fPath + ext;

  if (fs.existsSync(fPath) && !isDir(fPath)) return fPath;

  return null;
}

export const resolvePath = (basePath: string, pathToResolve: string) => {
  if (pathToResolve.startsWith('.')) {
    return baseResolve(path.resolve(path.dirname(basePath), pathToResolve));
  } else {
    const [firstPart, ...restPart] = pathToResolve.split('/').filter((s) => s !== '');
    const config = getConfig();

    if (firstPart in config.resolve.alias) {
      const aliasPath = config.resolve.alias[firstPart];
      return baseResolve(path.resolve(config.rootDir, aliasPath, ...restPart));
    } else {
      // Check in resolve.modules directories
      const { rootDir, resolve } = getConfig();

      for (const modulesDirName of resolve.modules) {
        const modulesDirPath = path.join(rootDir, modulesDirName);

        if (fs.existsSync(modulesDirPath)) {
          const moduleName = firstPart;
          let moduleDirPath = path.join(modulesDirPath, moduleName);

          if (moduleName.startsWith('@')) {
            // Using scoped package
            moduleDirPath = path.join(modulesDirPath, moduleName, restPart.shift());
          }

          if (restPart.length !== 0) {
            // Using subdirectories
            return baseResolve(path.join(moduleDirPath, ...restPart));
          } else {
            // Get from package.json
            const pkgJSONPath = path.join(moduleDirPath, 'package.json');
            if (fs.existsSync(pkgJSONPath)) {
              const pkgJSON = JSON.parse(fs.readFileSync(pkgJSONPath).toString());
              const scriptFilePath = pkgJSON.module || pkgJSON.main;
              if (scriptFilePath) return path.join(moduleDirPath, scriptFilePath);
            }

            const indexJSPath = path.join(moduleDirPath, 'index.js');
            if (fs.existsSync(indexJSPath)) return indexJSPath;
          }
        }
      }
    }
  }

  return null;
}

const JSONLoaderPlugin: ReboostPlugin = {
  load(filePath) {
    if (filePath.match(/\.json$/)) {
      const jsonString = fs.readFileSync(filePath).toString();
      const magicString = new MagicString(jsonString);
      magicString.prepend('export default ');

      return {
        code: magicString.toString(),
        original: jsonString,
        map: magicString.generateMap().toString()
      }
    }

    return null;
  }
}

const LoaderPlugin: ReboostPlugin = {
  load(filePath) {
    return {
      code: fs.readFileSync(filePath).toString()
    }
  }
}

const ResolverPlugin: ReboostPlugin = {
  resolve(importPath, importer) {
    if (importPath.startsWith('#/')) return importPath;
    return resolvePath(importer, importPath);
  }
}

const CommonJSPlugin: ReboostPlugin = {
  transformAST(ast, { traverse }) {
    let program: NodePath<t.Program>;
    let cjsModule = false;
    const uid = uniqueID(4);
    const modImports: t.ImportDeclaration[] = [];
    const importIdentifierMap = {} as Record<string, t.Identifier>;

    traverse(ast, {
      Program(path) {
        program = path;
      },
      CallExpression(path) {
        if (
          t.isIdentifier(path.node.callee, { name: 'require' }) &&
          t.isStringLiteral(path.node.arguments[0])
        ) {
          const importPath = path.node.arguments[0].value;
          const importIdentifier = importIdentifierMap[importPath] || path.scope.generateUidIdentifier(`$imported_${uid}`);

          if (!(importPath in importIdentifierMap)) {
            importIdentifierMap[importPath] = importIdentifier;
            modImports.push(
              t.importDeclaration(
                [t.importDefaultSpecifier(importIdentifier)],
                t.stringLiteral(importPath)
              )
            );
          }

          path.replaceWith(importIdentifier);
        }
      },
      MemberExpression(path) {
        if (
          (t.isIdentifier(path.node.object, { name: 'module' }) &&
          t.isIdentifier(path.node.property, { name: 'exports' })) ||
          t.isIdentifier(path.node.object, { name: 'exports' })
        ) {
          cjsModule = true;
        }
      }
    });

    if (cjsModule) {
      program.node.body.unshift(
        t.exportNamedDeclaration(
          t.variableDeclaration(
            'const',
            [t.variableDeclarator(t.identifier('__cjsModule'), t.booleanLiteral(true))]
          )
        ),
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier('module'),
              t.objectExpression([
                t.objectProperty(
                  t.identifier('exports'),
                  t.objectExpression([])
                )
              ])
            ),
          ]
        ),
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
             t.identifier('exports'),
              t.memberExpression(t.identifier('module'), t.identifier('exports'))
            )
          ]
        )
      );

      program.node.body.push(
        t.exportDefaultDeclaration(
          t.memberExpression(t.identifier('module'), t.identifier('exports'))
        )
      );
    }

    program.node.body.unshift(...modImports);
  }
}

const CommonJSInteropPlugin: ReboostPlugin = {
  setup(_, __, router) {
    const importerFunc = () => ({
      Default(mod: any, filePath: string) {
        const message = `The requested module "${filePath}" does not provide an export named "default"`;

        if (mod.__cjsModule && mod.default.__esModule) {
          if (!('default' in mod.default)) throw new SyntaxError(message);
          return mod.default.default;
        }
        if (!('default' in mod)) throw new SyntaxError(message);
        return mod.default;
      },
      Member(mod: any, member: string, filePath: string) {
        const message = `The requested module "${filePath}" does not provide an export named "${member}"`;

        if (mod.__cjsModule) {
          if (!(member in mod.default)) throw new SyntaxError(message);
          return mod.default[member];
        }
        if (!(member in mod)) throw new SyntaxError(message);
        return mod[member];
      },
      Star(mod: any) {
        if (mod.__cjsModule) return mod.default;
        return mod;
      }
    })

    router.get('/importer', async (ctx) => {
      ctx.type = 'text/javascript';
      ctx.body = `export default (${importerFunc.toString()})()`;
    });
  },
  transformAST(ast, { traverse }, filePath) {
    if (!filePath.match(/node_modules/)) {
      let program: NodePath<t.Program>;
      let importerIdentifier: t.Identifier;
      const declarators: t.VariableDeclarator[] = [];
      const replacements: [NodePath<t.ImportDeclaration>, t.ImportDeclaration][] = [];

      traverse(ast, {
        Program(path) {
          program = path;
        },
        ImportDeclaration(path) {
          const identifier = path.scope.generateUidIdentifier('$import');
          if (!importerIdentifier) importerIdentifier = path.scope.generateUidIdentifier('$importer');

          path.node.specifiers.forEach((specifier) => {
            let usage;
            let importedName;
            const localName = specifier.local.name;

            if (t.isImportDefaultSpecifier(specifier)) {
              usage = 'Default';
            } else if (t.isImportNamespaceSpecifier(specifier)) {
              usage = 'Star';
            } else if (t.isImportSpecifier(specifier)) {
              usage = 'Member';
              importedName = specifier.imported.name;
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
                    t.stringLiteral(filePath)
                  ] : [identifier, t.stringLiteral(filePath)]
                )
              )
            );
          });

          replacements.push([
            path,
            t.importDeclaration([
              t.importNamespaceSpecifier(identifier)
            ], t.stringLiteral(path.node.source.value))
          ]);
        }
      });

      if (importerIdentifier) {
        replacements.forEach(([path, replacement]) => {
          path.replaceWith(replacement);
        });

        program.node.body.unshift(
          t.importDeclaration([
            t.importDefaultSpecifier(importerIdentifier)
          ], t.stringLiteral('#/importer'))
        );

        const last = program.get('body').filter((path) => path.isImportDeclaration()).pop();
        const constDeclaration = t.variableDeclaration('const', declarators);
        if (last) {
          last.insertAfter(constDeclaration);
        } else {
          program.node.body.unshift(constDeclaration);
        }
      }
    }
  }
}

export const defaultPlugins = [
  JSONLoaderPlugin,
  LoaderPlugin,
  ResolverPlugin,
  CommonJSPlugin,
  CommonJSInteropPlugin
]
