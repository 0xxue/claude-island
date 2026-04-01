const { WebSocketServer } = require('ws');
const { EventEmitter } = require('events');
const PORT = 19432;

class IslandServer extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
  }
  start() {
    this.wss = new WebSocketServer({ port: PORT });
    console.log(`[Island] WS server on ws://127.0.0.1:${PORT}`);
    this.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.emit('claude-event', event);
        } catch {}
      });
    });
  }
  stop() { this.wss?.close(); }
}

module.exports = { IslandServer, PORT };
