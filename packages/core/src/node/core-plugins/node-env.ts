import { NodePath, types as t, builders as b, utils as u, is } from 'estree-toolkit';

import { ReboostPlugin, ReboostInstance } from '../index';

const replaceStatement = (path: NodePath, replaceWith: NodePath) => {
  if (
    is.program(path.parent) &&
    is.blockStatement(replaceWith)
  ) {
    path.replaceWithMultiple(replaceWith.node.body);
  } else {
    path.replaceWith(replaceWith.node);
  }
}

const evaluateParents = (parent: NodePath) => {
  if (
    is.ifStatement(parent) ||
    is.conditionalExpression(parent)
  ) {
    const evaluated = u.evaluateTruthy(parent.get('test'));
    if (evaluated == null) return;
    if (evaluated) {
      replaceStatement(parent, parent.get('consequent'));
    } else if (parent.has('alternate')) {
      replaceStatement(parent, parent.get('alternate'));
    } else {
      parent.remove();
    }
  } else if (
    is.logicalExpression(parent) ||
    is.binaryExpression(parent) ||
    is.unaryExpression(parent)
  ) {
    const evaluated = u.evaluateTruthy(parent);
    if (evaluated == null) return;
    parent.replaceWith(b.literal(evaluated));
    evaluateParents(parent.parentPath);
  }
}

export const runTransformation = (programPath: NodePath<t.Program>, mode: string) => {
  programPath.traverse({
    MemberExpression(path) {
      if (
        is.identifier(path.node.object, { name: 'process' }) &&
        is.identifier(path.node.property, { name: 'env' }) &&
        is.memberExpression(path.parentPath.node) &&
        is.identifier(path.parentPath.node.property, { name: 'NODE_ENV' })
      ) {
        const parent = path.parentPath;
        parent.replaceWith(b.literal(mode));
        evaluateParents(parent.parentPath);
      }
    }
  });
}

export const NodeEnvPlugin = (instance: ReboostInstance): ReboostPlugin => ({
  name: 'core-node-env-plugin',
  getCacheKey: () => instance.config.mode,
  transformAST(programPath) {
    runTransformation(programPath, instance.config.mode);
  }
})
