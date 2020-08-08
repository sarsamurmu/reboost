import type { HMRMapType } from './hmr';
import type { Importer } from './importer';

declare const address: string;
declare const debugMode: boolean;

type MapValue<T extends Map<any, any>> = ReturnType<T['get']>;

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

const debug = (...data: any) => debugMode && console.log(...data);

const Reboost: ReboostGlobalObject = {} as any;
const Private = ((): ReboostPrivateObject => {
  type P = ReboostPrivateObject;
  const dependentsMap = new Map<string, Set<string>>();
  // const dependencyMap = new Map<string, Set<string>>();

  const setDependencies: P['setDependencies'] = (file, dependencies) => {
    // dependencyMap.set(file, new Set(dependencies));
    dependencies.forEach((dependency) => {
      const dependents = dependentsMap.get(dependency);
      if (!dependents) {
        dependentsMap.set(dependency, new Set([file]))
      } else {
        dependents.add(file);
      }
    });
  }

  const dependentTreeFor: P['dependentTreeFor'] = (file) => {
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

Reboost.HMRReload = () => debugMode ? console.log('TRIGGER RELOAD') : location.reload();

const aSelf = self as any;
if (!aSelf.process) {
  aSelf.process = { env: { NODE_ENV: 'development' } };
}
aSelf['Reboost'] = Reboost;


const lastUpdatedData = {} as Record<string, number>;

let importer: Importer;
const loadImporter = new Promise((resolve) => {
  import(`${address}/importer`).then((mod) => {
    importer = mod.default;
    resolve();
  })
});

const makeLoopGuard = (max: number) => {
  let count = 0;

  return {
    call() {
      if (++count > max) {
        throw new Error(`Loop crossed the limit of ${max}`);
      }
    }
  }
}

const socket = new WebSocket(`ws://${address.replace(/^http(s?):\/\//, '')}`);

socket.addEventListener('open', () => {
  console.log('[reboost] Connected to the server');
});

socket.addEventListener('message', async ({ data }) => {
  const { type, file: emitterFile } = JSON.parse(data) as {
    type: string;
    file: string;
  };
  const { HMR_Map, HMR_Data_Map } = Private;

  if (type === 'change') {
    console.log(`[reboost] Changed ${emitterFile}`);

    const fileLastUpdated = lastUpdatedData[emitterFile];
    const now = Date.now();

    // Apply HMR only if file's last updated time is greater that 0.8s
    if (!fileLastUpdated || (((now - fileLastUpdated) / 1000) > 0.8)) {
      await loadImporter;

      const guard = makeLoopGuard(1000);
      const checkedFiles = new Set<string>();
      let bubbleUpDependents: DependentTree[];
      let nextBubbleUpDependents = [Private.dependentTreeFor(emitterFile)];
      let emitterFileData: MapValue<HMRMapType>;
      let handler;
      let dependentsAccepted: number;
      let dependentsAcceptedLevel2: number;
      let updatedModuleInstance: any;
      let hotData: Record<string, any>;

      while (nextBubbleUpDependents.length > 0) {
        guard.call();

        dependentsAccepted = 0;
        bubbleUpDependents = nextBubbleUpDependents;
        nextBubbleUpDependents = [];

        for (const { file, dependents } of bubbleUpDependents) {
          debug('[HMR] Checking -', file);

          if (checkedFiles.has(file)) continue;

          checkedFiles.add(file);

          if ((emitterFileData = HMR_Map.get(file))) {
            if (emitterFileData.declined) Reboost.HMRReload();

            hotData = {};
            emitterFileData.listeners.forEach(({ dispose }) => dispose && dispose(hotData));
            HMR_Data_Map.set(file, hotData);

            updatedModuleInstance = await import(`${address}/transformed?q=${encodeURI(file)}&t=${now}`);
            updatedModuleInstance = importer.All(updatedModuleInstance);

            // If the module is self accepted, just call the self accept handler
            // and finish the update (don't bubble up)
            if ((handler = emitterFileData.listeners.get(file)) && handler.accept) {
              debug('[HMR] Self accepted by', file);
              handler.accept(updatedModuleInstance);
              dependentsAccepted++;
            }

            dependentsAcceptedLevel2 = 0;

            dependents.forEach((tree) => {
              if ((handler = emitterFileData.listeners.get(tree.file)) && handler.accept) {
                debug('[HMR] Accepted by', tree.file);
                handler.accept(updatedModuleInstance);
                dependentsAcceptedLevel2++;
              } else if (tree.dependents.length > 0) {
                nextBubbleUpDependents.push(...tree.dependents);
              } else {
                debug('[HMR] Triggering Reload. The file has no parent -', tree.file);
                Reboost.HMRReload();
              }
            });

            HMR_Data_Map.delete(file);

            if (dependentsAcceptedLevel2 === dependents.length) dependentsAccepted++;
          } else if (dependents.length > 0) {
            nextBubbleUpDependents.push(...dependents);
          } else {
            debug('[HMR] Triggering Reload. The file has no parent -', file);
            Reboost.HMRReload();
          }
        }

        if (dependentsAccepted === bubbleUpDependents.length) {
          // All dependents handled the update
          debug('[HMR] Completed update');
          break;
        }
      }
    }
  } else if (type === 'unlink') {
    Reboost.HMRReload();
  }
});
