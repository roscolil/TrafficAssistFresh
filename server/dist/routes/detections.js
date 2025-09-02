"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const server_1 = require("../server");
const router = (0, express_1.Router)();
// Submit traffic detection
router.post('/', async (req, res) => {
    try {
        const { deviceId, detection, location, heading, timestamp } = req.body;
        const detectionId = (0, uuid_1.v4)();
        // Store detection in database
        await server_1.pool.query(`
      INSERT INTO detections (id, device_id, location, heading, timestamp, 
                             confidence, traffic_light_state, bbox)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9)
    `, [
            detectionId,
            deviceId,
            location.lng,
            location.lat,
            heading,
            new Date(timestamp),
            detection.confidence,
            detection.state,
            JSON.stringify(detection.bbox),
        ]);
        // Publish to Pub/Sub for real-time processing
        const eventData = {
            detectionId,
            deviceId,
            location,
            detection,
            timestamp,
        };
        await server_1.pubsub
            .topic('traffic-events')
            .publish(Buffer.from(JSON.stringify(eventData)));
        // Process nearby users for real-time alerts
        await processNearbyAlerts(location, detection, detectionId);
        res.status(201).json({
            detectionId,
            status: 'processed',
            message: 'Detection recorded successfully',
        });
    }
    catch (error) {
        console.error('Detection processing failed:', error);
        res.status(500).json({ error: 'Detection processing failed' });
    }
});
// Get detections for a device
router.get('/device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const result = await server_1.pool.query(`
      SELECT * FROM detections 
      WHERE device_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [deviceId, limit, offset]);
        res.json({
            detections: result.rows,
            total: result.rowCount,
        });
    }
    catch (error) {
        console.error('Failed to get detections:', error);
        res.status(500).json({ error: 'Failed to get detections' });
    }
});
// Confirm a detection
router.post('/:detectionId/confirm', async (req, res) => {
    try {
        const { detectionId } = req.params;
        const { confirmed, state } = req.body;
        await server_1.pool.query(`
      UPDATE detections 
      SET confirmed = $1, traffic_light_state = $2, cloud_processed = true
      WHERE id = $3
    `, [confirmed, state, detectionId]);
        res.json({
            success: true,
            message: 'Detection confirmed',
            detectionId,
        });
    }
    catch (error) {
        console.error('Detection confirmation failed:', error);
        res.status(500).json({ error: 'Confirmation failed' });
    }
});
async function processNearbyAlerts(location, detection, detectionId) {
    try {
        // Find nearby devices within 500m that were active in last 10 minutes
        const nearbyDevices = await server_1.pool.query(`
      SELECT DISTINCT d.id, d.push_token, d.platform
      FROM devices d
      JOIN detections det ON det.device_id = d.id
      WHERE ST_DWithin(
        det.location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        500
      )
      AND det.created_at > NOW() - INTERVAL '10 minutes'
      AND d.push_token IS NOT NULL
    `, [location.lng, location.lat]);
        // Create alert record
        if (nearbyDevices.rows.length > 0) {
            await server_1.pool.query(`
        INSERT INTO alerts (detection_id, alert_type, severity, message)
        VALUES ($1, $2, $3, $4)
      `, [
                detectionId,
                'traffic_detection',
                detection.confidence > 0.8 ? 'high' : 'medium',
                `${detection.state || 'Traffic light'} detected nearby`,
            ]);
        }
        // Broadcast via WebSocket to nearby grid cells
        const grid = getLocationGrid(location);
        server_1.io.to(`grid:${grid}`).emit('traffic_alert', {
            type: 'nearby_detection',
            detection,
            location,
            severity: detection.confidence > 0.8 ? 'high' : 'medium',
            timestamp: Date.now(),
        });
        console.log(`Alert sent to ${nearbyDevices.rows.length} nearby devices`);
    }
    catch (error) {
        console.error('Failed to process nearby alerts:', error);
    }
}
function getLocationGrid(location) {
    const latGrid = Math.floor(location.lat * 100) / 100;
    const lngGrid = Math.floor(location.lng * 100) / 100;
    return `${latGrid},${lngGrid}`;
}
exports.default = router;
