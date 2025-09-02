"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemStatus = exports.healthCheck = void 0;
// Health check endpoint
const healthCheck = (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        memory: {
            used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
            external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
        },
        cpu: {
            usage: process.cpuUsage(),
        },
    };
    res.status(200).json(healthData);
};
exports.healthCheck = healthCheck;
// Detailed system status
const systemStatus = async (req, res) => {
    try {
        const { pool } = require('../server');
        // Test database connection
        let dbStatus = 'disconnected';
        let dbLatency = null;
        try {
            const start = Date.now();
            await pool.query('SELECT 1');
            dbLatency = Date.now() - start;
            dbStatus = 'connected';
        }
        catch (error) {
            dbStatus = 'error';
        }
        const statusData = {
            status: 'operational',
            timestamp: new Date().toISOString(),
            services: {
                api: {
                    status: 'healthy',
                    uptime: process.uptime(),
                    version: process.env.npm_package_version || '1.0.0',
                },
                database: {
                    status: dbStatus,
                    latency: dbLatency ? `${dbLatency}ms` : null,
                    type: 'PostgreSQL',
                },
                pubsub: {
                    status: process.env.PUBSUB_EMULATOR_HOST ? 'emulator' : 'cloud',
                    configured: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
                },
                websocket: {
                    status: 'active',
                    connections: global.wsConnections || 0,
                },
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                memory: {
                    used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
                        100,
                    total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
                        100,
                    rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
                },
                loadAverage: require('os').loadavg(),
            },
        };
        res.status(200).json(statusData);
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get system status',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.systemStatus = systemStatus;
