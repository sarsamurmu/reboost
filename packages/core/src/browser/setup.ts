import type { HotMapType } from './hot';
import type { Importer } from './importer';

declare const address: string;
declare const debugMode: boolean;
declare const mode: string;

type MapValue<T extends Map<any, any>> = ReturnType<T['get']>;

type DependentTree = {
  file: string;
  dependents: DependentTree[];
}

interface ReboostGlobalObject {
  reload: () => void;
}

export interface ReboostGlobalWithPrivateObject extends ReboostGlobalObject {
  '[[Private]]': ReboostPrivateObject;
}

export interface ReboostPrivateObject {
  Hot_Map: HotMapType;
  Hot_Data_Map: Map<string, any>;
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
    Hot_Map: new Map(),
    Hot_Data_Map: new Map(),
    setDependencies,
    dependentTreeFor
  }
})();

Object.defineProperty(Reboost, '[[Private]]', {
  get: () => Private,
  enumerable: false,
  configurable: false
});

Reboost.reload = () => debugMode ? console.log('TRIGGER RELOAD') : self.location.reload();

const aSelf = self as any;
if (!aSelf.process) {
  aSelf.process = { env: { NODE_ENV: mode } };
} else {
  let a = aSelf.process;
  if (a) a = a.env;
  if (a) a.NODE_ENV = mode;
}
aSelf['Reboost'] = Reboost;

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

let lostConnection = false;

const connectWebsocket = () => {
  const socket = new WebSocket(`ws://${address.replace(/^https?:\/\//, '')}`);
  const fileLastChangedRecord = {} as Record<string, number>;
  let importer: Importer;
  let loadImporter: Promise<any>;

  socket.addEventListener('open', () => {
    console.log('[reboost] Connected to the server');

    lostConnection = false;

    loadImporter = new Promise((resolve) => {
      import(`${address}/importer`).then((mod) => {
        importer = mod.default;
        resolve();
      })
    });
  });

  socket.addEventListener('message', async ({ data }) => {
    const { type, file: emitterFile } = JSON.parse(data) as {
      type: string;
      file: string;
    };
    const { Hot_Map, Hot_Data_Map } = Private;

    if (type === 'change') {
      console.log(`[reboost] Changed ${emitterFile}`);

      const fileLastUpdated = fileLastChangedRecord[emitterFile];
      const now = fileLastChangedRecord[emitterFile] = Date.now();

      // Apply Hot Reload only if file's last updated time is greater that 0.8s
      if ((typeof fileLastUpdated === 'undefined') || (((now - fileLastUpdated) / 1000) > 0.8)) {
        await loadImporter;

        const guard = makeLoopGuard(1000);
        const checkedFiles = new Set<string>();
        let bubbleUpDependents: DependentTree[];
        let nextBubbleUpDependents = [Private.dependentTreeFor(emitterFile)];
        let emitterFileData: MapValue<HotMapType>;
        let handler;
        let updatedModuleInstance: any;
        let hotData: Record<string, any>;

        while (nextBubbleUpDependents.length > 0) {
          guard.call();

          bubbleUpDependents = nextBubbleUpDependents;
          nextBubbleUpDependents = [];

          for (const { file, dependents } of bubbleUpDependents) {
            debug('[Hot Reload] Checking -', file);

            if (checkedFiles.has(file)) continue;

            checkedFiles.add(file);

            if ((emitterFileData = Hot_Map.get(file))) {
              if (emitterFileData.declined) Reboost.reload();

              hotData = {};
              emitterFileData.listeners.forEach(({ dispose }) => dispose && dispose(hotData));
              Hot_Data_Map.set(file, hotData);

              updatedModuleInstance = await import(`${address}/transformed?q=${encodeURIComponent(file)}&t=${now}`);
              updatedModuleInstance = importer.All(updatedModuleInstance);

              // If the module is self accepted, just call the self accept handler
              // and finish the update (don't bubble up)
              if ((handler = emitterFileData.listeners.get(file)) && handler.accept) {
                debug('[Hot Reload] Self accepted by', file);
                handler.accept(updatedModuleInstance);
              } else {
                dependents.forEach((tree) => {
                  if ((handler = emitterFileData.listeners.get(tree.file)) && handler.accept) {
                    debug('[Hot Reload] Accepted by', tree.file);
                    handler.accept(updatedModuleInstance);
                  } else {
                    nextBubbleUpDependents.push(tree);
                  }
                });
              }

              Hot_Data_Map.delete(file);
            } else if (dependents.length > 0) {
              nextBubbleUpDependents.push(...dependents);
            } else {
              debug('[Hot Reload] Triggering full page reload. The file has no parent -', file);
              Reboost.reload();
            }
          }

          if (nextBubbleUpDependents.length === 0) {
            debug('[Hot Reload] Completed update');
          }
        }
      }
    } else if (type === 'unlink') {
      Reboost.reload();
    }
  });

  socket.addEventListener('close', () => {
    if (!lostConnection) {
      lostConnection = true;

      console.log('[reboost] Lost connection to the server. Trying to reconnect...');
    }

    setTimeout(() => connectWebsocket(), 5000);
  });
}

connectWebsocket();
