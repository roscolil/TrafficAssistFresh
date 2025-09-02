"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pubsub = exports.pool = exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pg_1 = require("pg");
const pubsub_1 = require("@google-cloud/pubsub");
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
exports.io = io;
// Database connection
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
exports.pool = pool;
// Pub/Sub client
const pubsub = new pubsub_1.PubSub();
exports.pubsub = pubsub;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);
// Import routes
const devices_1 = __importDefault(require("./routes/devices"));
const detections_1 = __importDefault(require("./routes/detections"));
const traffic_1 = __importDefault(require("./routes/traffic"));
const users_1 = __importDefault(require("./routes/users"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const health_1 = require("./routes/health");
// Health check routes
app.get('/health', health_1.healthCheck);
app.get('/api/status', health_1.systemStatus);
// API routes
app.use('/api/devices', devices_1.default);
app.use('/api/detections', detections_1.default);
app.use('/api/traffic', traffic_1.default);
app.use('/api/users', users_1.default);
app.use('/api/analytics', analytics_1.default);
// WebSocket handling
io.on('connection', socket => {
    console.log('Client connected:', socket.id);
    socket.on('subscribe_location', location => {
        const grid = getLocationGrid(location);
        socket.join(`grid:${grid}`);
        socket.emit('subscribed', { grid });
        console.log(`Client ${socket.id} subscribed to grid: ${grid}`);
    });
    socket.on('traffic_detection', async (data) => {
        try {
            const grid = getLocationGrid(data.location);
            // Broadcast to users in the same grid
            io.to(`grid:${grid}`).emit('traffic_update', {
                type: 'detection',
                data: data,
                timestamp: Date.now(),
            });
            // Publish to Pub/Sub for further processing
            await pubsub
                .topic('traffic-events')
                .publish(Buffer.from(JSON.stringify(data)));
            console.log(`Traffic detection broadcasted to grid: ${grid}`);
        }
        catch (error) {
            console.error('Error processing traffic detection:', error);
        }
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
function getLocationGrid(location) {
    // Create a grid system for location-based rooms (approx 1km grid)
    const latGrid = Math.floor(location.lat * 100) / 100;
    const lngGrid = Math.floor(location.lng * 100) / 100;
    return `${latGrid},${lngGrid}`;
}
// Database initialization
async function initializeDatabase() {
    try {
        // Create tables if they don't exist
        await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "postgis";
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP,
        preferences JSONB DEFAULT '{}'
      );
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        platform VARCHAR(50),
        user_agent TEXT,
        push_token TEXT,
        model VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS detections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID REFERENCES devices(id),
        location GEOGRAPHY(POINT, 4326),
        heading FLOAT,
        timestamp TIMESTAMP,
        confidence FLOAT,
        traffic_light_state VARCHAR(20),
        bbox JSONB,
        confirmed BOOLEAN DEFAULT FALSE,
        cloud_processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        detection_id UUID REFERENCES detections(id),
        alert_type VARCHAR(50),
        severity VARCHAR(20),
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID REFERENCES devices(id),
        event_name VARCHAR(100),
        properties JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        // Create indexes for performance
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_detections_location 
      ON detections USING GIST (location);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_detections_timestamp 
      ON detections (timestamp DESC);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_device 
      ON analytics_events (device_id, created_at DESC);
    `);
        console.log('Database initialized successfully');
    }
    catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}
// Start server
const PORT = process.env.PORT || 8080;
async function startServer() {
    await initializeDatabase();
    server.listen(PORT, () => {
        console.log(`🚀 Traffic Assist API server running on port ${PORT}`);
        console.log(`📍 Health check available at /health`);
        console.log(`🔌 WebSocket server ready for connections`);
    });
}
startServer().catch(console.error);
