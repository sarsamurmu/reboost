import type { ReboostGlobalWithPrivateObject } from './setup';

export type HMR = Readonly<{
  data: Record<string, any>;
  id: string;
  self: Readonly<{
    accept(callback: (module: any) => void): void;
    dispose(callback: (data: Record<string, any>) => void): void;
    decline(): void;
  }>;
  accept(dependency: string, callback: (module: any) => void): void;
  dispose(dependency: string, callback: (data: Record<string, any>) => void): void;
  decline(dependency: string): void;
  invalidate(): void;
}>;

export interface HandlerObject {
  accept?: (module: any) => void;
  dispose?: (data: Record<string, any>) => void;
}

export type HMRMapType = Map<string, {
  declined: boolean;
  listeners: Map<string, HandlerObject>
}>;

declare const address: string;
declare const filePath: string;
declare const Reboost: ReboostGlobalWithPrivateObject;

let HMR_Map: ReboostGlobalWithPrivateObject['[[Private]]']['HMR_Map'];
let HMR_Data_Map: ReboostGlobalWithPrivateObject['[[Private]]']['HMR_Data_Map'];

const getEmitterFileData = (emitterFile: string) => {
  if (!HMR_Map) ({ HMR_Map } = Reboost['[[Private]]']);

  if (!HMR_Map.has(emitterFile)) {
    HMR_Map.set(emitterFile, {
      declined: false,
      listeners: new Map()
    });
  }

  return HMR_Map.get(emitterFile);
}

const getListenerFileData = (emitterFile: string, listenerFile: string) => {
  const listenedFileData = getEmitterFileData(emitterFile);
  if (!listenedFileData.listeners.has(listenerFile)) listenedFileData.listeners.set(listenerFile, {});
  return listenedFileData.listeners.get(listenerFile);
}

const resolveDependency = async (dependency: string) => {
  const response = await fetch(`${address}/resolve?from=${filePath}&to=${dependency}`);
  if (!response.ok) {
    console.error(`[reboost] Unable to resolve dependency "${dependency}" of "${filePath}" while using hot.accept()`);
    return 'UNRESOLVED';
  }
  return response.text();
}

const hot: HMR = {
  get data() {
    return (
      HMR_Data_Map ||
      (HMR_Data_Map = Reboost['[[Private]]'].HMR_Data_Map)
    ).get(filePath);
  },
  id: filePath,
  self: {
    accept(callback): void {
      const listenerData = getListenerFileData(filePath, filePath);
      if (!listenerData.accept) listenerData.accept = callback;
    },
    dispose(callback): void {
      const listenerData = getListenerFileData(filePath, filePath);
      if (!listenerData.dispose) listenerData.dispose = callback;
    },
    decline() {
      getEmitterFileData(filePath).declined = true;
    }
  },
  async accept(dependency, callback) {
    const listenerData = getListenerFileData(await resolveDependency(dependency), filePath);
    if (!listenerData.accept) listenerData.accept = callback;
  },
  async dispose(dependency, callback) {
    const listenerData = getListenerFileData(await resolveDependency(dependency), filePath);
    if (!listenerData.dispose) listenerData.dispose = callback;
  },
  async decline(dependency) {
    getEmitterFileData(await resolveDependency(dependency)).declined = true;
  },
  invalidate() {
    Reboost.HMRReload();
  }
}

// TODO: Remove it in v1.0
Object.defineProperties(hot, {
  selfAccept: {
    enumerable: false,
    value: hot.self.accept
  },
  selfDispose: {
    enumerable: false,
    value: hot.self.dispose
  }
});

Object.freeze(hot.self);
Object.freeze(hot);

export { hot }
