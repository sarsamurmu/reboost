import type { Importer } from './importer';

declare const address: string;
declare const debugMode: boolean;
declare const mode: string;
declare const hotReload: boolean;

type MapValue<T extends Map<any, any>> = ReturnType<T['get']>;

type DependentTree = {
  file: string;
  dependents: DependentTree[];
}

interface ReboostGlobalObject {
  reload: () => void;
}

export interface ReboostPrivateObject {
  Hot_Map: HotMapType;
  Hot_Data_Map: Map<string, any>;
  setDependencies(file: string, dependencies: string[]): void;
  dependentTreeFor(file: string): DependentTree;
}

const debug = (...data: any) => debugMode && console.log(...data);

const Reboost: ReboostGlobalObject = {
  // eslint-disable-next-line no-constant-condition
  reload: () => (false && debugMode) ? console.log('TRIGGER RELOAD') : self.location.reload()
};

const Private = ((): ReboostPrivateObject => {
  type P = ReboostPrivateObject;
  const dependentsMap = new Map<string, Set<string>>();

  const setDependencies: P['setDependencies'] = (file, dependencies) => {
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

Object.defineProperty(Reboost, '[[Private]]', { get: () => Private });

{
  const aSelf = self as any;
  if (!aSelf.process) {
    aSelf.process = { env: { NODE_ENV: mode } };
  } else {
    let a = aSelf.process;
    if (a) a = a.env;
    if (a) a.NODE_ENV = mode;
  }
  aSelf['Reboost'] = Reboost;
}

{
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

      loadImporter = new Promise<void>((resolve) => {
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

        if (!hotReload) {
          console.log('[reboost] Hot Reload is disabled. Triggering full reload.');
          return Reboost.reload();
        }

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
}

// -----------------
// Hot Reloader Code
// -----------------

type AcceptCB = {
  /**
   * @param module The updated module
   */
  (module: any): void;
}
type DisposeCB = {
  /** 
   * @param data A object that you can use to pass the data to the updated module
   */
  (data: Record<string, any>): void;
}

export interface HandlerObject {
  accept?: AcceptCB;
  dispose?: DisposeCB;
}

export type HotMapType = Map<string, {
  declined: boolean;
  listeners: Map<string, HandlerObject>
}>;

const getEmitterFileData = (emitterFile: string) => {
  if (!Private.Hot_Map.has(emitterFile)) {
    Private.Hot_Map.set(emitterFile, {
      declined: false,
      listeners: new Map()
    });
  }

  return Private.Hot_Map.get(emitterFile);
}

const getListenerFileData = (emitterFile: string, listenerFile: string) => {
  const listenedFileData = getEmitterFileData(emitterFile);
  if (!listenedFileData.listeners.has(listenerFile)) listenedFileData.listeners.set(listenerFile, {});
  return listenedFileData.listeners.get(listenerFile);
}

type CallbackT<T> = 'accept' extends T ? AcceptCB : DisposeCB;
export class Hot {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async callSetter<T extends 'accept' | 'dispose'>(
    type: T,
    a: string | CallbackT<T>,
    b?: CallbackT<T>
  ) {
    let dependencyFilePath: string;
    let callback: CallbackT<T>;

    if (typeof a === 'function') {
      // Self
      dependencyFilePath = this.filePath;
      callback = a;
    } else {
      dependencyFilePath = await this.resolveDependency(a, type);
      callback = b;
    }

    const listenerData = getListenerFileData(dependencyFilePath, this.filePath);
    if (!listenerData[type]) listenerData[type] = callback;
  }

  private async resolveDependency(dependency: string, fnName: 'accept' | 'dispose' | 'decline') {
    const response = await fetch(`${address}/resolve?from=${this.filePath}&to=${dependency}`);
    if (!response.ok) {
      console.error(`[reboost] Unable to resolve dependency "${dependency}" of "${this.filePath}" while using hot.${fnName}()`);
      return 'UNRESOLVED';
    }
    return response.text();
  }

  /** The data passed from the disposal callbacks */
  get data(): Record<string, any> {
    return Private.Hot_Data_Map.get(this.filePath);
  }
  /** The id of the module, it can be used as a key to store data about the module */
  get id(): string {
    return this.filePath;
  }
  /** 
   * Sets accept listener for the module itself
   * @param callback The callback which will be triggered on module update
   */
  accept(callback: AcceptCB): void;
  /**
   * Sets accept listener for a dependency of the module
   * @param dependency Path to the dependency
   * @param callback The callback which will be triggered on module update
   */
  accept(dependency: string, callback: AcceptCB): void;
  accept(a: string | AcceptCB, b?: AcceptCB) {
    this.callSetter('accept', a, b);
  }
  /**
   * Sets dispose listener for the module itself
   * @param callback The callback which will triggered on module disposal
   */
  dispose(callback: DisposeCB): void;
  /**
   * Sets dispose listener for a dependency of the module
   * @param dependency Path to the dependency
   * @param callback The callback which will triggered on module disposal
   */
  dispose(dependency: string, callback: DisposeCB): void;
  dispose(a: string | DisposeCB, b?: DisposeCB) {
    this.callSetter('dispose', a, b);
  }
  /** Marks the module itself as not Hot Reload-able */
  decline(): void;
  /** 
   * Marks the dependency of the module as not Hot Reload-able
   * @param dependency Path to the dependency
   */
  decline(dependency: string): void;
  async decline(dependency?: string) {
    getEmitterFileData(
      dependency || await this.resolveDependency(dependency, 'decline')
    ).declined = true;
  }
  /** Invalidates the Hot Reload phase and causes a full page reload */
  invalidate(): void {
    Reboost.reload();
  }

  // TODO: Remove these in v1.0
  private get self() {
    return {
      accept: this.selfAccept.bind(this),
      dispose: this.selfDispose.bind(this)
    }
  }
  private selfAccept(callback: AcceptCB) {
    this.accept(callback);
  }
  private selfDispose(callback: DisposeCB) {
    this.dispose(callback);
  }
}
