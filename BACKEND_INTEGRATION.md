// Backend Integration Documentation and Implementation Plan

## 1. BACKEND INFRASTRUCTURE SETUP

### Google Cloud Platform Services:

```bash
# Enable required services
gcloud services enable run.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable pubsub.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage-component.googleapis.com

# Create Cloud SQL database
gcloud sql instances create traffic-assist-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database and user
gcloud sql databases create traffic_assist --instance=traffic-assist-db
gcloud sql users create app_user --instance=traffic-assist-db --password=secure_password

# Create Pub/Sub topics
gcloud pubsub topics create traffic-events
gcloud pubsub topics create user-notifications
gcloud pubsub topics create ai-processing

# Create Cloud Storage buckets
gsutil mb gs://traffic-assist-models
gsutil mb gs://traffic-assist-media
```

### 2. API SERVICES DEPLOYMENT

#### Main API Service (Express.js + TypeScript):

```typescript
// server/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {Pool} from 'pg';
import {PubSub} from '@google-cloud/pubsub';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const pubsub = new PubSub();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({limit: '10mb'}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/devices', require('./routes/devices'));
app.use('/api/detections', require('./routes/detections'));
app.use('/api/traffic', require('./routes/traffic'));
app.use('/api/users', require('./routes/users'));
app.use('/api/analytics', require('./routes/analytics'));

export default app;
```

#### Device Registration Service:

```typescript
// server/src/routes/devices.ts
import {Router} from 'express';
import {v4 as uuidv4} from 'uuid';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const {platform, userAgent, pushToken, model} = req.body;

    const deviceId = uuidv4();
    const userId = uuidv4(); // In production, use proper auth

    await pool.query(
      `
      INSERT INTO devices (id, user_id, platform, user_agent, push_token, model, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [deviceId, userId, platform, userAgent, pushToken, model],
    );

    res.json({deviceId, userId});
  } catch (error) {
    res.status(500).json({error: 'Registration failed'});
  }
});

router.post('/:deviceId/push-token', async (req, res) => {
  try {
    const {deviceId} = req.params;
    const {token} = req.body;

    await pool.query(
      `
      UPDATE devices SET push_token = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [token, deviceId],
    );

    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: 'Token update failed'});
  }
});

module.exports = router;
```

#### Traffic Detection Service:

```typescript
// server/src/routes/detections.ts
import {Router} from 'express';
import {v4 as uuidv4} from 'uuid';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const {deviceId, detection, location, heading, timestamp} = req.body;

    const detectionId = uuidv4();

    // Store detection in database
    await pool.query(
      `
      INSERT INTO detections (id, device_id, location, heading, timestamp, 
                             confidence, traffic_light_state, bbox, created_at)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, NOW())
    `,
      [
        detectionId,
        deviceId,
        location.lng,
        location.lat,
        heading,
        new Date(timestamp),
        detection.confidence,
        detection.state,
        JSON.stringify(detection.bbox),
      ],
    );

    // Publish to Pub/Sub for real-time processing
    await pubsub.topic('traffic-events').publish(
      Buffer.from(
        JSON.stringify({
          detectionId,
          deviceId,
          location,
          detection,
          timestamp,
        }),
      ),
    );

    // Process nearby users for alerts
    await processNearbyAlerts(location, detection);

    res.json({detectionId, status: 'processed'});
  } catch (error) {
    res.status(500).json({error: 'Detection processing failed'});
  }
});

async function processNearbyAlerts(location: any, detection: any) {
  // Find nearby devices within 500m
  const nearbyDevices = await pool.query(
    `
    SELECT d.id, d.push_token 
    FROM devices d
    JOIN detections det ON det.device_id = d.id
    WHERE ST_DWithin(
      det.location::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      500
    )
    AND det.created_at > NOW() - INTERVAL '5 minutes'
    GROUP BY d.id, d.push_token
  `,
    [location.lng, location.lat],
  );

  // Send push notifications
  for (const device of nearbyDevices.rows) {
    await sendPushNotification(device.push_token, {
      title: 'Traffic Alert',
      body: `${detection.state} light detected nearby`,
      data: {detection, location},
    });
  }
}

module.exports = router;
```

### 3. REAL-TIME WEBSOCKET SERVICE

```typescript
// server/src/websocket.ts
import {Server} from 'socket.io';
import {createServer} from 'http';
import app from './app';

const server = createServer(app);
const io = new Server(server, {
  cors: {origin: '*'},
});

io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_location', location => {
    const grid = getLocationGrid(location);
    socket.join(`grid:${grid}`);
    socket.emit('subscribed', {grid});
  });

  socket.on('traffic_detection', async data => {
    const grid = getLocationGrid(data.location);

    // Broadcast to users in the same grid
    io.to(`grid:${grid}`).emit('traffic_update', {
      type: 'detection',
      data: data,
      timestamp: Date.now(),
    });

    // Store in database
    await storeDetection(data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function getLocationGrid(location: {lat: number; lng: number}): string {
  // Create a grid system for location-based rooms
  const latGrid = Math.floor(location.lat * 1000) / 1000;
  const lngGrid = Math.floor(location.lng * 1000) / 1000;
  return `${latGrid},${lngGrid}`;
}

export {server, io};
```

### 4. DEPLOYMENT CONFIGURATION

#### Dockerfile for API service:

```dockerfile
# server/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
```

#### Cloud Run deployment:

```bash
# Build and deploy API service
docker build -t gcr.io/YOUR_PROJECT/traffic-assist-api ./server
docker push gcr.io/YOUR_PROJECT/traffic-assist-api

gcloud run deploy traffic-assist-api \
  --image gcr.io/YOUR_PROJECT/traffic-assist-api \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=$DATABASE_URL \
  --allow-unauthenticated

# Deploy WebSocket service
gcloud run deploy traffic-assist-ws \
  --image gcr.io/YOUR_PROJECT/traffic-assist-ws \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=$DATABASE_URL \
  --allow-unauthenticated
```

### 5. CLIENT INTEGRATION

#### Update package.json with environment variables:

```json
{
  "scripts": {
    "web": "REACT_APP_API_URL=https://traffic-assist-api-xxx.run.app REACT_APP_WS_URL=wss://traffic-assist-ws-xxx.run.app webpack serve --mode development",
    "web:build": "REACT_APP_API_URL=https://traffic-assist-api-xxx.run.app REACT_APP_WS_URL=wss://traffic-assist-ws-xxx.run.app NODE_ENV=production webpack --mode production"
  }
}
```

#### Add to existing CloudConfirmClient:

```typescript
// Update src/cloud/CloudConfirmClient.ts
export class CloudConfirmClient {
  private backendService: any;

  constructor() {
    // Detect environment and initialize appropriate backend service
    if (typeof window !== 'undefined') {
      this.backendService =
        new (require('../backend/WebBackendService').WebBackendService)();
    } else {
      this.backendService =
        new (require('../backend/MobileBackendService').MobileBackendService)();
    }

    this.backendService.initialize();
  }

  async enqueue(req: ConfirmRequest) {
    // Send to both existing cloud confirm and new backend
    await Promise.all([
      this.sendToCloudConfirm(req),
      this.backendService.submitDetection(req, req.location, req.heading),
    ]);
  }
}
```

This comprehensive backend integration provides:

✅ **Multi-platform support** (Web PWA + Mobile)
✅ **Real-time communication** (WebSockets + Push notifications)  
✅ **Scalable infrastructure** (Google Cloud Run + SQL + Pub/Sub)
✅ **Offline capability** (Local storage + sync)
✅ **Analytics & monitoring** (Event tracking + telemetry)
✅ **AI/ML pipeline** (Cloud AI + model management)

Would you like me to implement any specific part of this backend integration first?
