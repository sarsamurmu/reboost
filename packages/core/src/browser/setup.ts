import type { HMRMapType } from './hmr';
import type { Importer } from './importer';

declare const address: string;

const aSelf = self as any;
if (!aSelf.process) {
  aSelf.process = {
    env: {
      NODE_ENV: 'development'
    }
  }
}

type DependentTree = {
  file: string;
  dependents: DependentTree[];
}

interface ReboostGlobalObject {
  HMRReload: () => void;
}

export interface ReboostGlobalWithPrivateObject extends ReboostGlobalObject {
  '[[Private]]': ReboostPrivateObject;
}

export interface ReboostPrivateObject {
  HMR_Map: HMRMapType;
  HMR_Data_Map: Map<string, any>;
  setDependencies(file: string, dependencies: string[]): void;
  dependentTreeFor(file: string): DependentTree;
}

const Reboost: ReboostGlobalObject = {} as any;
const Private = ((): ReboostPrivateObject => {
  const dependentsMap = new Map<string, Set<string>>();
  const dependencyMap = new Map<string, Set<string>>();

  const setDependencies = (file: string, dependencies: string[]) => {
    dependencyMap.set(file, new Set(dependencies));
    dependencies.forEach((dependency) => {
      const dependents = dependentsMap.get(dependency);
      if (!dependents) {
        dependentsMap.set(dependency, new Set([file]))
      } else {
        dependents.add(file);
      }
    });
  }

  const dependentTreeFor = (file: string): DependentTree => {
    const dependentTrees: DependentTree[] = [];

    const dependents = dependentsMap.get(file) || ([] as string[]);
    dependents.forEach((dFile: string) => {
      dependentTrees.push(dependentTreeFor(dFile));
    });

    return {
      file: file,
      dependents: dependentTrees
    }
  }

  return {
    HMR_Map: new Map(),
    HMR_Data_Map: new Map(),
    setDependencies,
    dependentTreeFor
  }
})();

Object.defineProperty(Reboost, '[[Private]]', {
  get: () => Private,
  enumerable: false,
  configurable: false
});

Reboost.HMRReload = () => location.reload(true);

(self as any)['Reboost'] = Reboost;

const socket = new WebSocket(`ws://${address.replace(/^http(s?):\/\//, '')}`);

socket.addEventListener('open', () => {
  console.log('[reboost] Connected to the server');
  // ? Should we send message to server that we're connected?
});

const lastUpdatedData = {} as Record<string, number>;

let importer: Importer;
const loadImporter = new Promise((resolve) => {
  import(`${address}/importer`).then((mod) => {
    importer = mod.default;
    resolve();
  })
});

socket.addEventListener('message', async ({ data }) => {
  const { type, file: emitterFile } = JSON.parse(data) as {
    type: string;
    file: string;
  };
  const { HMR_Map, HMR_Data_Map } = Private;

  if (type === 'change') {
    if (HMR_Map.has(emitterFile)) {
      const fileLastUpdated = lastUpdatedData[emitterFile];
      const now = Date.now();

      // Apply HMR only if file's last updated time is greater that 0.8s
      if (!fileLastUpdated || (((now - fileLastUpdated) / 1000) > 0.8)) {
        await loadImporter;

        const hotDataObj = {};
        const listeners = HMR_Map.get(emitterFile).listeners;
        HMR_Data_Map.set(emitterFile, hotDataObj);
        lastUpdatedData[emitterFile] = now;

        if (HMR_Map.get(emitterFile).declined) Reboost.HMRReload();

        const selfHandlers = listeners.get(emitterFile);
        const selfAcceptCallback = (selfHandlers || {}).accept;

        // If the module is self accepted, just call the self dispose handler (don't call other handlers)
        if (selfAcceptCallback) {
          if (selfHandlers.dispose) selfHandlers.dispose(hotDataObj);
        } else {
          listeners.forEach(({ dispose }) => dispose && dispose(hotDataObj));
        }

        import(`${address}/transformed?q=${encodeURI(emitterFile)}&t=${now}`).then((mod) => {
          // If the module is self accepted, just call the self accept handler
          // and finish the update (don't call other handlers)
          if (selfAcceptCallback) {
            selfAcceptCallback(importer.All(mod));
          } else {
            listeners.forEach(({ accept }) => {
              if (accept) accept(importer.All(mod));
            });
          }

          HMR_Data_Map.delete(emitterFile);
        });
      }
    } else {
      Reboost.HMRReload();
    }
  } else if (type === 'unlink') {
    Reboost.HMRReload();
  }
});
