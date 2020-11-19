import type { ReboostGlobalWithPrivateObject } from './setup';


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

export type Hot = Readonly<{
  /** The data passed from the disposal callbacks */
  data: Record<string, any>;
  /** The id of the module, it can be used as a key to store data about the module */
  id: string;
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
  /** Marks the module itself as not Hot Reload-able */
  decline(): void;
  /** 
   * Marks the dependency of the module as not Hot Reload-able
   * @param dependency Path to the dependency
   */
  decline(dependency: string): void;
  /** Invalidates the Hot Reload phase and causes a full page reload */
  invalidate(): void;
}>;

export interface HandlerObject {
  accept?: AcceptCB;
  dispose?: DisposeCB;
}

export type HotMapType = Map<string, {
  declined: boolean;
  listeners: Map<string, HandlerObject>
}>;

declare const address: string;
declare const filePath: string;
declare const Reboost: ReboostGlobalWithPrivateObject;

let Hot_Map: ReboostGlobalWithPrivateObject['[[Private]]']['Hot_Map'];
let Hot_Data_Map: ReboostGlobalWithPrivateObject['[[Private]]']['Hot_Data_Map'];

const getEmitterFileData = (emitterFile: string) => {
  if (!Hot_Map) ({ Hot_Map } = Reboost['[[Private]]']);

  if (!Hot_Map.has(emitterFile)) {
    Hot_Map.set(emitterFile, {
      declined: false,
      listeners: new Map()
    });
  }

  return Hot_Map.get(emitterFile);
}

const getListenerFileData = (emitterFile: string, listenerFile: string) => {
  const listenedFileData = getEmitterFileData(emitterFile);
  if (!listenedFileData.listeners.has(listenerFile)) listenedFileData.listeners.set(listenerFile, {});
  return listenedFileData.listeners.get(listenerFile);
}

const resolveDependency = async (dependency: string, fnName: 'accept' | 'dispose' | 'decline') => {
  const response = await fetch(`${address}/resolve?from=${filePath}&to=${dependency}`);
  if (!response.ok) {
    console.error(`[reboost] Unable to resolve dependency "${dependency}" of "${filePath}" while using hot.${fnName}()`);
    return 'UNRESOLVED';
  }
  return response.text();
}

const makeSetCallbackFn = <T extends 'accept' | 'dispose'>(type: T) => {
  type CallbackT = 'accept' extends T ? AcceptCB : DisposeCB;

  return async (a: string | CallbackT, b?: CallbackT) => {
    let dependencyFilePath: string;
    let callback: CallbackT;

    if (typeof a === 'function') {
      // Self
      dependencyFilePath = filePath;
      callback = a;
    } else {
      dependencyFilePath = await resolveDependency(a, type);
      callback = b;
    }

    const listenerData = getListenerFileData(dependencyFilePath, filePath);
    if (!listenerData[type]) listenerData[type] = callback;
  }
}

const hot: Hot = {
  get data() {
    return (
      Hot_Data_Map ||
      (Hot_Data_Map = Reboost['[[Private]]'].Hot_Data_Map)
    ).get(filePath);
  },
  id: filePath,
  accept: makeSetCallbackFn('accept'),
  dispose: makeSetCallbackFn('dispose'),
  decline: async (dependency?: string) => {
    getEmitterFileData(
      dependency || await resolveDependency(dependency, 'decline')
    ).declined = true;
  },
  invalidate: () => Reboost.reload()
}

// TODO: Remove these in v1.0
{
  Object.defineProperties(hot, {
    selfAccept: {
      value: hot.accept
    },
    selfDispose: {
      value: hot.dispose
    },
    self: {
      value: {
        accept: hot.accept,
        dispose: hot.dispose
      }
    }
  });
  Object.freeze((hot as any).self);
}

Object.freeze(hot);

export { hot }
