import * as t from '@babel/types';
import traverse, { NodePath } from '@babel/traverse';

import { ReboostPlugin, ReboostInstance } from '../index';

const replaceStatement = (path: NodePath, replaceWith: NodePath) => {
  if (replaceWith.isBlockStatement()) {
    path.replaceWithMultiple(replaceWith.node.body);
  } else {
    path.replaceWith(replaceWith.node);
  }
}

const evaluateParents = (parent: NodePath) => {
  if (
    parent.isIfStatement() ||
    parent.isConditionalExpression()
  ) {
    const evaluated = (parent.get('test') as NodePath).evaluateTruthy();
    if (typeof evaluated === 'undefined') return;
    if (evaluated) {
      replaceStatement(parent, parent.get('consequent') as NodePath);
    } else if (parent.node.alternate) {
      replaceStatement(parent, parent.get('alternate') as NodePath);
    } else {
      parent.remove();
    }
  } else if (
    parent.isLogicalExpression() ||
    parent.isBinaryExpression() ||
    parent.isUnaryExpression()
  ) {
    const evaluated = parent.evaluateTruthy();
    if (typeof evaluated === 'undefined') return;
    parent.replaceWith(t.booleanLiteral(evaluated));
    evaluateParents(parent.parentPath);
  }
}

export const runTransformation = (ast: t.Node, mode: string) => {
  traverse(ast, {
    noScope: true,
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object, { name: 'process' }) &&
        t.isIdentifier(path.node.property, { name: 'env' }) &&
        t.isMemberExpression(path.parentPath.node) &&
        t.isIdentifier(path.parentPath.node.property, { name: 'NODE_ENV' })
      ) {
        const parent = path.parentPath;
        parent.replaceWith(t.stringLiteral(mode));
        evaluateParents(parent.parentPath);
      }
    }
  });
}

export const NodeEnvPlugin = (instance: ReboostInstance): ReboostPlugin => ({
  name: 'core-node-env-plugin',
  getCacheKey: () => instance.config.mode,
  transformAST(ast) {
    runTransformation(ast, instance.config.mode);
  }
})
