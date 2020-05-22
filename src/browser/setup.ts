import { HMRMapType } from './hmr';

declare const address: string;

const aWindow = window as any;
aWindow._REBOOST_ADDRESS_ = address;
aWindow.process = {
  env: {
    NODE_ENV: 'development'
  }
}

const socket = new WebSocket(`ws://${address}`);
if (!aWindow.$_HMR_MAP_) aWindow.$_HMR_MAP_ = new Map();
const HMR_MAP: HMRMapType = aWindow.$_HMR_MAP_;

let importer: any;
const loadImporter = new Promise((resolve) => {
  import(`http://${address}/importer`).then((mod) => {
    importer = mod.default;
    resolve();
  })
});

socket.addEventListener('open', () => {
  console.log('[reboost] Connected to the server');
  // TODO: Send message to server that we're connected
});

socket.addEventListener('message', async ({ data }) => {
  // TODO: Add support for HMR
  // location.reload();
  const { type, file: acceptedFile } = JSON.parse(data);

  if (type === 'change') {
    if (HMR_MAP.has(acceptedFile)) {
      await loadImporter;

      // Dynamically import with query `t` as random stuff or browser will get file from cache
      import(`http://${address}/transformed?q=${encodeURI(acceptedFile)}&t=${encodeURI(new Date().toISOString())}`).then((mod) => {
        for (const { accept, dispose } of HMR_MAP.get(acceptedFile).values()) {
          if (dispose) dispose();
          if (accept && (accept(importer.All(mod)) === false)) {
            location.reload();
            break;
          }
        }
      });
    } else {
      location.reload();
    }
  }
});
