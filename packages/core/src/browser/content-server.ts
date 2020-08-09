declare const debugMode: boolean;

const debug = (...data: any) => debugMode && console.log(...data);

let lostConnection = false;

const connect = () => {
  const socket = new WebSocket(`ws://${location.host}`);

  socket.addEventListener('open', () => {
    if (lostConnection) self.location.reload();

    debug('[reboost] Connected to the content server');
  });

  socket.addEventListener('message', () => self.location.reload());

  socket.addEventListener('close', () => {
    if (!lostConnection) {
      debug('[reboost] Lost connection to the content server');
      lostConnection = true;
    }

    setTimeout(() => connect(), 5000);
  });
}

connect();
