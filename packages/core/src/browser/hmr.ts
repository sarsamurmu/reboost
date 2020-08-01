export type HMR = Readonly<{
  data: Record<string, any>;
  id: string;
  self: Readonly<{
    accept(callback: (module: any) => void): void;
    dispose(callback: (data: Record<string, any>) => void): void;
  }>;
  accept(dependency: string, callback: (module: any) => void): void;
  dispose(dependency: string, callback: (data: Record<string, any>) => void): void;
  decline(): void;
}>;

export type HMRMapType = Map<string, {
  declined: boolean;
  listeners: Map<string, {
    accept?: (module: any) => void;
    dispose?: (data: Record<string, any>) => void;
  }>
}>;

declare const address: string;
declare const filePath: string;

const aWindow = window as any;
if (!aWindow.$_HMR_MAP_) aWindow.$_HMR_MAP_ = new Map();
if (!aWindow.$_HMR_DATA_MAP_) aWindow.$_HMR_DATA_MAP_ = new Map();
const HMR_MAP: HMRMapType = aWindow.$_HMR_MAP_;
const HMR_DATA_MAP: Map<string, any> = aWindow.$_HMR_DATA_MAP_;

const getEmitterFileData = (emitter: string) => {
  if (!HMR_MAP.has(emitter)) {
    HMR_MAP.set(emitter, {
      declined: false,
      listeners: new Map()
    });
  }
  return HMR_MAP.get(emitter);
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
    return HMR_DATA_MAP.get(filePath);
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
  decline() {
    getEmitterFileData(filePath).declined = true;
  }
};

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
