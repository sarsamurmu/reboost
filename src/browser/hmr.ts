export interface HMR {
  data: undefined | Record<string, any>;
  self: {
    accept(callback: (module: any) => void | false): void;
    dispose(callback: (data: Record<string, any>) => void): void;
  };
  accept(dependency: string, callback: (module: any) => void | false): void;
  dispose(dependency: string, callback: (data: Record<string, any>) => void): void;
}

export type HMRMapType = Map<string, Map<string, {
  accept?: (module: any) => void | false;
  dispose?: (data: Record<string, any>) => void;
}>>;

declare const address: string;
declare const filePath: string;

const aWindow = window as any;
if (!aWindow.$_HMR_MAP_) aWindow.$_HMR_MAP_ = new Map();
if (!aWindow.$_HMR_DATA_MAP_) aWindow.$_HMR_DATA_MAP_ = new Map();
const HMR_MAP: HMRMapType = aWindow.$_HMR_MAP_;
const HMR_DATA_MAP: Map<string, {}> = aWindow.$_HMR_DATA_MAP_;

const getAcceptor = (acceptedFile: string, acceptorFile: string) => {
  if (!HMR_MAP.has(acceptedFile)) HMR_MAP.set(acceptedFile, new Map());
  const acceptedFileMap = HMR_MAP.get(acceptedFile);
  if (!acceptedFileMap.has(acceptorFile)) acceptedFileMap.set(acceptorFile, {});
  return acceptedFileMap.get(acceptorFile);
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
  self: {
    accept(callback) {
      const acceptorFileData = getAcceptor(filePath, filePath);
      if (!acceptorFileData.accept) acceptorFileData.accept = callback;
    },
    dispose(callback) {
      const acceptorFileData = getAcceptor(filePath, filePath);
      if (!acceptorFileData.dispose) acceptorFileData.dispose = callback;
    }
  },
  async accept(dependency, callback) {
    const acceptorFileData = getAcceptor(await resolveDependency(dependency), filePath);
    if (!acceptorFileData.accept) acceptorFileData.accept = callback;
  },
  async dispose(dependency, callback) {
    const acceptorFileData = getAcceptor(await resolveDependency(dependency), filePath);
    if (!acceptorFileData.dispose) acceptorFileData.dispose = callback;
  }
};

(hot as any).selfAccept = hot.self.accept;
(hot as any).selfDispose = hot.self.dispose;

export { hot }
