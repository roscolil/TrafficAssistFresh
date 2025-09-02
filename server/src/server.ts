import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {Pool} from 'pg';
import {PubSub} from '@google-cloud/pubsub';
import {Server} from 'socket.io';
import {createServer} from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : false,
});

// Pub/Sub client
const pubsub = new PubSub();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({limit: '10mb'}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Import routes
import deviceRoutes from './routes/devices';
import detectionRoutes from './routes/detections';
import trafficRoutes from './routes/traffic';
import userRoutes from './routes/users';
import analyticsRoutes from './routes/analytics';
import {healthCheck, systemStatus} from './routes/health';

// Health check routes
app.get('/health', healthCheck);
app.get('/api/status', systemStatus);

// API routes
app.use('/api/devices', deviceRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// WebSocket handling
io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_location', location => {
    const grid = getLocationGrid(location);
    socket.join(`grid:${grid}`);
    socket.emit('subscribed', {grid});
    console.log(`Client ${socket.id} subscribed to grid: ${grid}`);
  });

  socket.on('traffic_detection', async data => {
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
    } catch (error) {
      console.error('Error processing traffic detection:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function getLocationGrid(location: {lat: number; lng: number}): string {
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
  } catch (error) {
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

export {app, io, pool, pubsub};
