export interface HMR {
  selfAccept(callback: (module: any) => void | false): void;
  selfDispose(callback: () => void): void;
  accept(dependency: string, callback: (module: any) => void | false): void;
  dispose(dependency: string, callback: () => void): void;
}

export type HMRMapType = Map<string, Map<string, {
  accept?: (module: any) => void | false;
  dispose?: () => void;
}>>;

declare const address: string;
declare const filePath: string;

const aWindow = window as any;
if (!aWindow.$_HMR_MAP_) aWindow.$_HMR_MAP_ = new Map();
const HMR_MAP: HMRMapType = aWindow.$_HMR_MAP_;

const getAcceptor = (acceptedFile: string, acceptorFile: string) => {
  if (!HMR_MAP.has(acceptedFile)) HMR_MAP.set(acceptedFile, new Map());
  const acceptedFileMap = HMR_MAP.get(acceptedFile);
  if (!acceptedFileMap.has(acceptorFile)) acceptedFileMap.set(acceptorFile, {});
  return acceptedFileMap.get(acceptorFile);
}

const resolveDependency = async (dependency: string) => {
  const response = await(fetch(`http://${address}/resolve?from=${filePath}&to=${dependency}`));
  if (!response.ok) {
    console.error(`[reboost] Unable to resolve dependency "${dependency}" of "${filePath}" while using hot.accept()`);
    return 'UNRESOLVED';
  }
  return response.text();
}

export const hot: HMR = {
  selfAccept(callback) {
    const acceptorFileData = getAcceptor(filePath, filePath);
    if (!acceptorFileData.accept) acceptorFileData.accept = callback;
  },
  selfDispose(callback) {
    const acceptorFileData = getAcceptor(filePath, filePath);
    if (!acceptorFileData.dispose) acceptorFileData.dispose = callback;
  },
  async accept(dependency, callback) {
    const acceptorFileData = getAcceptor(await resolveDependency(dependency), filePath);
    if (!acceptorFileData.accept) acceptorFileData.accept = callback;
  },
  async dispose(dependency, callback) {
    const acceptorFileData = getAcceptor(await resolveDependency(dependency), filePath);
    if (!acceptorFileData.dispose) acceptorFileData.dispose = callback;
  }
}
