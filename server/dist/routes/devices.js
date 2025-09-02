"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const server_1 = require("../server");
const router = (0, express_1.Router)();
// Register a new device
router.post('/register', async (req, res) => {
    try {
        const { platform, userAgent, pushToken, model } = req.body;
        const deviceId = (0, uuid_1.v4)();
        // Create or get user (simplified - in production, use proper auth)
        const userResult = await server_1.pool.query(`
      INSERT INTO users (id) VALUES (uuid_generate_v4())
      RETURNING id
    `);
        const userId = userResult.rows[0].id;
        // Register device
        await server_1.pool.query(`
      INSERT INTO devices (id, user_id, platform, user_agent, push_token, model)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [deviceId, userId, platform, userAgent, pushToken, model]);
        res.status(201).json({
            deviceId,
            userId,
            message: 'Device registered successfully',
        });
    }
    catch (error) {
        console.error('Device registration failed:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
// Update push token
router.post('/:deviceId/push-token', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { token } = req.body;
        await server_1.pool.query(`
      UPDATE devices 
      SET push_token = $1, updated_at = NOW()
      WHERE id = $2
    `, [token, deviceId]);
        res.json({ success: true, message: 'Push token updated' });
    }
    catch (error) {
        console.error('Push token update failed:', error);
        res.status(500).json({ error: 'Token update failed' });
    }
});
// Update push subscription (for web)
router.post('/:deviceId/push-subscription', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const subscription = req.body;
        await server_1.pool.query(`
      UPDATE devices 
      SET push_token = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(subscription), deviceId]);
        res.json({ success: true, message: 'Push subscription updated' });
    }
    catch (error) {
        console.error('Push subscription update failed:', error);
        res.status(500).json({ error: 'Subscription update failed' });
    }
});
// Get device info
router.get('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const result = await server_1.pool.query(`
      SELECT d.*, u.preferences 
      FROM devices d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [deviceId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Failed to get device:', error);
        res.status(500).json({ error: 'Failed to get device info' });
    }
});
exports.default = router;
