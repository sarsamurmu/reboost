import type { HMRMapType } from './hmr';
import type { Importer } from './importer';

declare const address: string;

const aWindow = window as any;
aWindow._REBOOST_ADDRESS_ = address;
if (!aWindow.process) {
  aWindow.process = {
    env: {
      NODE_ENV: 'development'
    }
  }
}

const socket = new WebSocket(`ws://${address.replace(/^http(s?):\/\//, '')}`);
if (!aWindow.$_HMR_MAP_) aWindow.$_HMR_MAP_ = new Map();
if (!aWindow.$_HMR_DATA_MAP_) aWindow.$_HMR_DATA_MAP_ = new Map();
const HMR_MAP: HMRMapType = aWindow.$_HMR_MAP_;
const HMR_DATA_MAP: Map<string, any> = aWindow.$_HMR_DATA_MAP_;

const lastUpdatedData = {} as Record<string, number>;

let importer: Importer;
const loadImporter = new Promise((resolve) => {
  import(`${address}/importer`).then((mod) => {
    importer = mod.default;
    resolve();
  })
});

socket.addEventListener('open', () => {
  console.log('[reboost] Connected to the server');
  // ? Should we send message to server that we're connected?
});

const reloadPage = () => {
  // ? Maybe we can ask user if they really want to reload?
  location.reload();
}

socket.addEventListener('message', async ({ data }) => {
  const {
    type,
    file: emitterFile
  }: {
    type: string;
    file: string;
  } = JSON.parse(data);

  if (type === 'change') {
    if (HMR_MAP.has(emitterFile)) {
      const fileLastUpdated = lastUpdatedData[emitterFile];
      const now = Date.now();

      // Apply HMR only if file's last updated time is greater that 0.8s
      if (!fileLastUpdated || (((now - fileLastUpdated) / 1000) > 0.8)) {
        await loadImporter;

        HMR_DATA_MAP.set(emitterFile, {});
        lastUpdatedData[emitterFile] = now;

        if (HMR_MAP.get(emitterFile).declined) reloadPage();

        HMR_MAP.get(emitterFile).listeners.forEach(({ dispose }) => {
          if (dispose) dispose(HMR_DATA_MAP.get(emitterFile));
        });

        import(`${address}/transformed?q=${encodeURI(emitterFile)}&t=${now}`).then((mod) => {
          HMR_MAP.get(emitterFile).listeners.forEach(({ accept }) => {
            if (accept) accept(importer.All(mod));
          });

          HMR_DATA_MAP.delete(emitterFile);
        });
      }
    } else {
      reloadPage();
    }
  } else if (type === 'unlink') {
    reloadPage();
  }
});
