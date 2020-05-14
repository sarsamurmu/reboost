// declare const address: string;

export default (address: string) => {
  const socket = new WebSocket(`ws://${address}`);

  (window as any).reboostEnabled = true;

  socket.addEventListener('open', () => {
    console.log('[reboost] Connected to server');
    // TODO: Send message to server that we're connected
  });

  socket.addEventListener('message', ({ data }) => {
    // TODO: Add support for HMR
    location.reload();
  });
}
