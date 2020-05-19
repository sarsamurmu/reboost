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
      console.log('JSON');
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
    return resolvePath(importer, importPath);
  }
}

const CommonJSPlugin: ReboostPlugin = {
  transformAST(ast, { traverse }) {
    let program: NodePath<t.Program>;
    let exportIdentifier: t.Identifier;
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
        let toReplace;

        if (
          t.isIdentifier(path.node.object, { name: 'module' }) &&
          t.isIdentifier(path.node.property, { name: 'exports' })
        ) {
          toReplace = path;
        } else if (
          t.isIdentifier(path.node.object, { name: 'exports' })
        ) {
          toReplace = path.get('object');
        }

        if (toReplace) {
          if (!exportIdentifier) exportIdentifier = t.identifier(`$exports_${uid}`);
          toReplace.replaceWith(exportIdentifier);
        }
      }
    });

    if (exportIdentifier) {
      program.node.body.unshift(
        t.variableDeclaration(
          'let',
          [t.variableDeclarator(exportIdentifier, t.objectExpression([]))]
        )
      );

      program.node.body.push(t.exportDefaultDeclaration(exportIdentifier));
    }

    program.node.body.unshift(...modImports);
  }
}

export const defaultPlugins = [
  JSONLoaderPlugin,
  LoaderPlugin,
  ResolverPlugin,
  CommonJSPlugin
]
