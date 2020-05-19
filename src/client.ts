// declare const address: string;

export default (address: string) => {
  (window as any).reboostEnabled = true;
  (window as any).process = {
    env: {
      NODE_ENV: 'development'
    }
  }

  const socket = new WebSocket(`ws://${address}`);

  socket.addEventListener('open', () => {
    console.log('[reboost] Connected to server');
    // TODO: Send message to server that we're connected
  });

  socket.addEventListener('message', ({ data }) => {
    // TODO: Add support for HMR
    location.reload();
  });
}
