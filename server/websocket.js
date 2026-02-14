const { WebSocketServer } = require('ws');

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const userConnections = new Map(); // userId -> Set<ws>

  wss.on('connection', (ws, req) => {
    // Parse userId from query string: /ws?userId=xxx
    const url = new URL(req.url, 'http://localhost');
    const userId = url.searchParams.get('userId');

    if (userId) {
      if (!userConnections.has(userId)) userConnections.set(userId, new Set());
      userConnections.get(userId).add(ws);
    }

    ws.on('close', () => {
      if (userId && userConnections.has(userId)) {
        userConnections.get(userId).delete(ws);
        if (userConnections.get(userId).size === 0) userConnections.delete(userId);
      }
    });

    ws.on('error', () => {});
  });

  return {
    broadcast(event, data) {
      const msg = JSON.stringify({ event, data });
      wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(msg);
      });
    },
    sendToUser(userId, event, data) {
      const connections = userConnections.get(userId);
      if (!connections) return;
      const msg = JSON.stringify({ event, data });
      connections.forEach(ws => {
        if (ws.readyState === 1) ws.send(msg);
      });
    },
    getConnectionCount() {
      return wss.clients.size;
    }
  };
}

module.exports = { setupWebSocket };
