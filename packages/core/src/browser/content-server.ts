declare const debugMode: boolean;

const debug = (...data: any) => debugMode && console.log(...data);

let lostConnection = false;

const connect = () => {
  const socket = new WebSocket(`ws://${location.host}`);

  socket.addEventListener('open', () => {
    if (lostConnection) self.location.reload();

    debug('Connected to the content server');
  });

  socket.addEventListener('message', () => self.location.reload());

  socket.addEventListener('close', () => {
    debug('Socket closed');

    lostConnection = true;

    setTimeout(() => connect(), 5000);
  });
}

connect();
