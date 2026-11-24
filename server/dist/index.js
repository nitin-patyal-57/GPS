"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = require("http");
const ws_1 = require("ws");
const database_1 = require("./services/database");
const devices_1 = __importDefault(require("./routes/devices"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const ota_1 = __importDefault(require("./routes/ota"));
const websocket_1 = require("./services/websocket");
const mqttService_1 = require("./services/mqttService");
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
exports.server = server;
const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
// API Routes
app.use('/api', devices_1.default);
app.use('/api', alerts_1.default);
app.use('/api', ota_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'GPS Telemetry Server',
        timestamp: new Date().toISOString(),
        mqtt: (0, mqttService_1.getMqttStatus)(),
    });
});
// Serve static frontend assets if built (for unified deployment on Render)
const distPath = path_1.default.resolve(__dirname, '../../dist');
if (fs_1.default.existsSync(distPath)) {
    app.use(express_1.default.static(distPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
            return next();
        }
        const indexPath = path_1.default.join(distPath, 'index.html');
        if (fs_1.default.existsSync(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            next();
        }
    });
}
// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected to live GPS stream');
    (0, websocket_1.addClient)(ws);
});
const PORT = process.env.PORT || 3001;
(0, database_1.initDatabase)().then(() => {
    (0, mqttService_1.initMqttService)(websocket_1.broadcast);
    server.listen(PORT, () => {
        console.log(`GPS Server running on port ${PORT}`);
        console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
        console.log(`WebSocket live stream: ws://localhost:${PORT}/ws`);
    });
}).catch((err) => {
    console.error('Failed to initialize GPS server:', err);
    process.exit(1);
});
exports.default = app;
