"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addClient = addClient;
exports.broadcast = broadcast;
exports.getConnectedClientCount = getConnectedClientCount;
const ws_1 = require("ws");
const clients = new Set();
function addClient(ws) {
    clients.add(ws);
    ws.on('close', () => {
        clients.delete(ws);
    });
    ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err.message);
        clients.delete(ws);
    });
    // Send initial welcome
    try {
        ws.send(JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() }));
    }
    catch { }
}
function broadcast(event, data) {
    const message = JSON.stringify({ event, data });
    for (const client of clients) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.send(message);
            }
            catch (err) {
                console.error('[WebSocket] Broadcast error:', err);
            }
        }
    }
}
function getConnectedClientCount() {
    return clients.size;
}
