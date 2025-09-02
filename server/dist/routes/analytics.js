"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const router = (0, express_1.Router)();
// Get analytics overview
router.get('/overview', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        let interval = '24 hours';
        switch (timeframe) {
            case '1h':
                interval = '1 hour';
                break;
            case '24h':
                interval = '24 hours';
                break;
            case '7d':
                interval = '7 days';
                break;
            case '30d':
                interval = '30 days';
                break;
        }
        // Get basic metrics
        const metrics = await server_1.pool.query(`
      SELECT 
        COUNT(DISTINCT d.device_id) as active_devices,
        COUNT(d.id) as total_detections,
        AVG(d.confidence) as avg_confidence,
        COUNT(DISTINCT u.id) as active_users
      FROM detections d
      LEFT JOIN devices dev ON dev.id = d.device_id
      LEFT JOIN users u ON dev.id = ANY(u.device_ids)
      WHERE d.created_at > NOW() - INTERVAL $1
    `, [interval]);
        // Get detection distribution by state
        const stateDistribution = await server_1.pool.query(`
      SELECT 
        traffic_light_state,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
      FROM detections 
      WHERE created_at > NOW() - INTERVAL $1
      GROUP BY traffic_light_state
      ORDER BY count DESC
    `, [interval]);
        // Get hourly activity
        const hourlyActivity = await server_1.pool.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as detections,
        AVG(confidence) as avg_confidence
      FROM detections 
      WHERE created_at > NOW() - INTERVAL $1
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [interval]);
        // Get top locations
        const topLocations = await server_1.pool.query(`
      SELECT 
        ST_X(location) as lng,
        ST_Y(location) as lat,
        COUNT(*) as detection_count,
        AVG(confidence) as avg_confidence
      FROM detections 
      WHERE created_at > NOW() - INTERVAL $1
      GROUP BY ST_SnapToGrid(location, 0.01)
      ORDER BY detection_count DESC
      LIMIT 10
    `, [interval]);
        res.json({
            overview: metrics.rows[0] || {
                active_devices: 0,
                total_detections: 0,
                avg_confidence: 0,
                active_users: 0,
            },
            stateDistribution: stateDistribution.rows,
            hourlyActivity: hourlyActivity.rows,
            topLocations: topLocations.rows,
            timeframe,
        });
    }
    catch (error) {
        console.error('Failed to get analytics overview:', error);
        res.status(500).json({ error: 'Failed to get analytics overview' });
    }
});
// Get performance metrics
router.get('/performance', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        let interval = '24 hours';
        switch (timeframe) {
            case '1h':
                interval = '1 hour';
                break;
            case '24h':
                interval = '24 hours';
                break;
            case '7d':
                interval = '7 days';
                break;
            case '30d':
                interval = '30 days';
                break;
        }
        // Detection accuracy metrics
        const accuracy = await server_1.pool.query(`
      SELECT 
        AVG(confidence) as avg_confidence,
        COUNT(CASE WHEN confirmed = true THEN 1 END) as confirmed_detections,
        COUNT(*) as total_detections,
        COUNT(CASE WHEN confidence > 0.8 THEN 1 END) as high_confidence_detections
      FROM detections 
      WHERE created_at > NOW() - INTERVAL $1
    `, [interval]);
        // Response time metrics (from detection to cloud processing)
        const responseTimes = await server_1.pool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) as median_processing_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) as p95_processing_time
      FROM detections 
      WHERE created_at > NOW() - INTERVAL $1
        AND updated_at IS NOT NULL
    `, [interval]);
        // Device performance
        const devicePerformance = await server_1.pool.query(`
      SELECT 
        d.platform,
        COUNT(det.id) as detections,
        AVG(det.confidence) as avg_confidence,
        COUNT(DISTINCT d.id) as device_count
      FROM devices d
      LEFT JOIN detections det ON det.device_id = d.id 
        AND det.created_at > NOW() - INTERVAL $1
      GROUP BY d.platform
      ORDER BY detections DESC
    `, [interval]);
        const accuracyData = accuracy.rows[0] || {
            avg_confidence: 0,
            confirmed_detections: 0,
            total_detections: 0,
            high_confidence_detections: 0,
        };
        const confirmationRate = accuracyData.total_detections > 0
            ? (accuracyData.confirmed_detections / accuracyData.total_detections) *
                100
            : 0;
        const highConfidenceRate = accuracyData.total_detections > 0
            ? (accuracyData.high_confidence_detections /
                accuracyData.total_detections) *
                100
            : 0;
        res.json({
            accuracy: {
                ...accuracyData,
                confirmation_rate: confirmationRate,
                high_confidence_rate: highConfidenceRate,
            },
            responseTimes: responseTimes.rows[0] || {
                avg_processing_time: 0,
                median_processing_time: 0,
                p95_processing_time: 0,
            },
            devicePerformance: devicePerformance.rows,
            timeframe,
        });
    }
    catch (error) {
        console.error('Failed to get performance metrics:', error);
        res.status(500).json({ error: 'Failed to get performance metrics' });
    }
});
// Get geographical analytics
router.get('/geography', async (req, res) => {
    try {
        const { bounds, timeframe = '24h' } = req.query;
        let interval = '24 hours';
        switch (timeframe) {
            case '1h':
                interval = '1 hour';
                break;
            case '24h':
                interval = '24 hours';
                break;
            case '7d':
                interval = '7 days';
                break;
            case '30d':
                interval = '30 days';
                break;
        }
        let whereClause = 'WHERE d.created_at > NOW() - INTERVAL $1';
        const params = [interval];
        // Add bounds filter if provided
        if (bounds) {
            const [swLat, swLng, neLat, neLng] = bounds.split(',').map(parseFloat);
            whereClause += ` AND ST_Within(d.location, ST_MakeEnvelope($2, $3, $4, $5, 4326))`;
            params.push(swLng, swLat, neLng, neLat);
        }
        // Get detection density by grid
        const densityGrid = await server_1.pool.query(`
      SELECT 
        ST_X(ST_SnapToGrid(d.location, 0.001)) as grid_lng,
        ST_Y(ST_SnapToGrid(d.location, 0.001)) as grid_lat,
        COUNT(*) as detection_count,
        AVG(d.confidence) as avg_confidence,
        STRING_AGG(DISTINCT d.traffic_light_state, ',') as states
      FROM detections d
      ${whereClause}
      GROUP BY ST_SnapToGrid(d.location, 0.001)
      HAVING COUNT(*) >= 2
      ORDER BY detection_count DESC
      LIMIT 1000
    `, params);
        // Get traffic patterns by area
        const trafficPatterns = await server_1.pool.query(`
      SELECT 
        traffic_light_state,
        ST_X(ST_Centroid(ST_Collect(d.location))) as center_lng,
        ST_Y(ST_Centroid(ST_Collect(d.location))) as center_lat,
        COUNT(*) as frequency,
        AVG(d.confidence) as avg_confidence
      FROM detections d
      ${whereClause}
      GROUP BY traffic_light_state
      HAVING COUNT(*) >= 5
      ORDER BY frequency DESC
    `, params);
        res.json({
            densityGrid: densityGrid.rows,
            trafficPatterns: trafficPatterns.rows,
            bounds: bounds ? bounds.split(',').map(parseFloat) : null,
            timeframe,
        });
    }
    catch (error) {
        console.error('Failed to get geographical analytics:', error);
        res.status(500).json({ error: 'Failed to get geographical analytics' });
    }
});
// Get real-time metrics
router.get('/realtime', async (req, res) => {
    try {
        // Last 15 minutes of activity
        const realtimeActivity = await server_1.pool.query(`
      SELECT 
        DATE_TRUNC('minute', created_at) as minute,
        COUNT(*) as detections,
        COUNT(DISTINCT device_id) as active_devices,
        AVG(confidence) as avg_confidence
      FROM detections 
      WHERE created_at > NOW() - INTERVAL '15 minutes'
      GROUP BY DATE_TRUNC('minute', created_at)
      ORDER BY minute DESC
    `);
        // Current active connections (from devices table last_seen)
        const activeConnections = await server_1.pool.query(`
      SELECT 
        platform,
        COUNT(*) as count
      FROM devices 
      WHERE last_seen > NOW() - INTERVAL '5 minutes'
      GROUP BY platform
    `);
        // Recent alerts
        const recentAlerts = await server_1.pool.query(`
      SELECT 
        a.*,
        d.traffic_light_state,
        ST_X(det.location) as lng,
        ST_Y(det.location) as lat
      FROM alerts a
      JOIN detections det ON det.id = a.detection_id
      LEFT JOIN devices d ON d.id = det.device_id
      WHERE a.created_at > NOW() - INTERVAL '15 minutes'
      ORDER BY a.created_at DESC
      LIMIT 20
    `);
        res.json({
            activity: realtimeActivity.rows,
            activeConnections: activeConnections.rows,
            recentAlerts: recentAlerts.rows,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Failed to get real-time metrics:', error);
        res.status(500).json({ error: 'Failed to get real-time metrics' });
    }
});
exports.default = router;
