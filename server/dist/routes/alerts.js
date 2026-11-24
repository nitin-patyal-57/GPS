"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../services/database");
const router = (0, express_1.Router)();
// GET /api/alerts
router.get('/alerts', (req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const rows = db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 50').all();
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/alerts/:id/ack
router.post('/alerts/:id/ack', (req, res) => {
    try {
        const db = (0, database_1.getDb)();
        db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
