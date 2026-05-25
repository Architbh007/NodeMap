import type { DetectedEndpoint, EndpointFlow, EndpointFlowStep, ArchitectureLayer } from '@nodemap/types';

/**
 * Endpoint Flow Builder
 *
 * Turns a DetectedEndpoint into a step-by-step execution flow:
 *   request -> route -> controller -> service[] -> repository[] -> database -> response
 *
 * Returns a partial flow when the chain can't be fully resolved (no fail).
 */

function step(layer: ArchitectureLayer, label: string, path?: string, fileId?: string, detail?: string): EndpointFlowStep {
  return { layer, label, path: path ?? label, fileId, detail };
}

export function buildEndpointFlow(ep: DetectedEndpoint): EndpointFlow {
  const steps: EndpointFlowStep[] = [];

  steps.push(step('entry', `${ep.method} ${ep.path}`, ep.path, undefined, 'Incoming request'));

  // Middleware chain
  for (const mw of ep.middleware) {
    steps.push(step('middleware', mw.split('/').pop() ?? mw, mw, undefined, 'Middleware'));
  }

  // Route file
  steps.push(step(
    'route',
    ep.routeFile.split('/').pop() ?? ep.routeFile,
    ep.routeFile,
    ep.routeFileId,
    ep.handler ? `handler: ${ep.handler}` : undefined,
  ));

  if (ep.controllerFile) {
    steps.push(step(
      'controller',
      ep.controllerFile.split('/').pop() ?? ep.controllerFile,
      ep.controllerFile,
      ep.controllerFileId,
    ));
  } else if (!ep.handler && ep.serviceChain.length === 0 && ep.repositoryChain.length === 0) {
    steps.push(step('unknown', 'unknown handler', '?', undefined, 'Chain could not be detected'));
  }

  for (let i = 0; i < ep.serviceChain.length; i++) {
    steps.push(step(
      'service',
      ep.serviceChain[i].split('/').pop() ?? ep.serviceChain[i],
      ep.serviceChain[i],
      ep.serviceChainIds[i],
    ));
  }

  for (let i = 0; i < ep.repositoryChain.length; i++) {
    steps.push(step(
      'repository',
      ep.repositoryChain[i].split('/').pop() ?? ep.repositoryChain[i],
      ep.repositoryChain[i],
      ep.repositoryChainIds[i],
    ));
  }

  if (ep.repositoryChain.length > 0 || ep.database) {
    steps.push(step(
      'unknown',
      ep.database ?? 'database',
      ep.database ?? 'database',
      undefined,
      'Data layer',
    ));
  }

  steps.push(step('entry', 'response', 'response', undefined, 'Returned to client'));

  return { endpoint: ep, steps };
}
