const Wb = require("ws");

class WebSocket {
  constructor() {
    this.uploadSessions = new Map();
  }
  connect(server) {
    const wss = new Wb.Server({ server });
    wss.on("connection", (ws, req) => {
      ws.on("message", (msg) => {
        try {
          const { uploadSessionId } = JSON.parse(msg);
          if (uploadSessionId) {
            this.uploadSessions.set(uploadSessionId, ws);
          }
        } catch (err) {
          console.log(err.message, "web socket");
          throw err;
        }
      });

      ws.on("close", () => {
        for (const [key, client] of this.uploadSessions.entries()) {
          if (client === ws) this.uploadSessions.delete(key);
        }
      });
    });
  }

  send(uploadSessionId, data) {
    const ws = this.uploadSessions.get(uploadSessionId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }
}

module.exports = WebSocket;
