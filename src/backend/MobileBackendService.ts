# Traffic Assist Backend Integration Plan

## Current State
- ✅ Web PWA deployed on Google Cloud Platform (App Engine)
- ✅ Mobile React Native app with native module support
- ✅ Cloud Run endpoint for traffic light confirmation
- ✅ EventEmitter-based client for real-time updates

## Backend Technologies Integration

### 1. API Gateway & Microservices (Google Cloud)

#### Core Services:
- **Traffic Detection API** (Cloud Run)
- **User Management API** (Cloud Run) 
- **Real-time Updates** (Cloud Pub/Sub + WebSockets)
- **Analytics & Telemetry** (BigQuery + Cloud Functions)
- **Media Processing** (Cloud Storage + Cloud Vision AI)

#### Infrastructure:
- **API Gateway**: Route requests, rate limiting, authentication
- **Cloud Load Balancer**: Global traffic distribution
- **Cloud CDN**: Static asset caching for web app
- **Cloud Armor**: DDoS protection and security

### 2. Database Architecture

#### Primary Database (Cloud SQL - PostgreSQL):
```sql
-- Users and devices
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP,
  preferences JSONB
);

CREATE TABLE devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_type VARCHAR(50), -- 'web', 'ios', 'android'
  push_token VARCHAR(512),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Traffic detection data
CREATE TABLE detections (
  id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(id),
  location POINT, -- PostGIS geographic point
  heading FLOAT,
  timestamp TIMESTAMP,
  confidence FLOAT,
  traffic_light_state VARCHAR(20),
  bbox JSONB, -- bounding box coordinates
  confirmed BOOLEAN DEFAULT FALSE,
  cloud_processed BOOLEAN DEFAULT FALSE
);

-- Real-time alerts and cues
CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  detection_id UUID REFERENCES detections(id),
  alert_type VARCHAR(50),
  severity VARCHAR(20),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Cache Layer (Cloud Memorystore - Redis):
```redis
# Real-time user sessions
SET user:session:{user_id} {session_data} EX 3600

# Geospatial traffic data
GEOADD traffic:lights {longitude} {latitude} {light_id}
GEORADIUS traffic:lights {lng} {lat} 1000 m WITHCOORD

# Rate limiting
INCR rate_limit:{user_id}:{endpoint} EX 60
```

### 3. Real-time Communication

#### WebSocket Server (Node.js + Socket.io):
```javascript
// Real-time updates for traffic conditions
io.on('connection', (socket) => {
  socket.on('subscribe_location', (location) => {
    socket.join(`location:${location.grid}`);
  });
  
  socket.on('traffic_detection', (data) => {
    // Process detection
    // Broadcast to nearby users
    io.to(`location:${data.grid}`).emit('traffic_update', data);
  });
});
```

#### Cloud Pub/Sub Integration:
```typescript
// Publish traffic events
await pubSubClient.topic('traffic-events').publish({
  data: Buffer.from(JSON.stringify(detectionData)),
  attributes: {
    location: `${lat},${lng}`,
    severity: 'high'
  }
});
```

### 4. AI/ML Pipeline

#### Cloud AI Platform:
- **AutoML Vision**: Traffic light state detection
- **Cloud Functions**: Real-time inference triggers
- **Vertex AI**: Model training and deployment
- **Cloud Storage ML**: Model versioning

```python
# Cloud Function for AI processing
import functions_framework
from google.cloud import aiplatform

@functions_framework.cloud_event
def process_detection(cloud_event):
    # Enhance local detection with cloud AI
    prediction = aiplatform.predict(
        endpoint=TRAFFIC_LIGHT_ENDPOINT,
        instances=[image_data]
    )
    return prediction
```

## 2. Mobile App Backend Integration

Let me create mobile-specific backend integration:

<function_calls>
<invoke name="create_file">
<parameter name="content">// Mobile Backend Service Integration
import AsyncStorage from '@react-native-async-storage/async-storage';
import {cloudConfirmClient} from '../cloud/CloudConfirmClient';

export class MobileBackendService {
  private static instance: MobileBackendService;
  private userId: string | null = null;
  private deviceId: string | null = null;
  private wsConnection: WebSocket | null = null;

  static getInstance(): MobileBackendService {
    if (!MobileBackendService.instance) {
      MobileBackendService.instance = new MobileBackendService();
    }
    return MobileBackendService.instance;
  }

  // Initialize device and user
  async initialize() {
    await this.loadStoredCredentials();
    await this.registerDevice();
    await this.connectRealtime();
  }

  private async loadStoredCredentials() {
    this.userId = await AsyncStorage.getItem('user_id');
    this.deviceId = await AsyncStorage.getItem('device_id');
  }

  private async registerDevice() {
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      model: DeviceInfo.getModel(),
    };

    const response = await fetch(`${API_BASE_URL}/devices/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(deviceInfo),
    });

    const data = await response.json();
    this.deviceId = data.deviceId;
    this.userId = data.userId;

    await AsyncStorage.setItem('device_id', this.deviceId);
    await AsyncStorage.setItem('user_id', this.userId);
  }

  // Push notifications setup
  async setupPushNotifications() {
    const messaging = require('@react-native-firebase/messaging');
    
    const token = await messaging().getToken();
    await this.updatePushToken(token);

    messaging().onMessage(async remoteMessage => {
      // Handle foreground notifications
      this.handleTrafficAlert(remoteMessage.data);
    });
  }

  private async updatePushToken(token: string) {
    await fetch(`${API_BASE_URL}/devices/${this.deviceId}/push-token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token}),
    });
  }

  // Real-time traffic updates
  private async connectRealtime() {
    this.wsConnection = new WebSocket(`${WS_URL}?deviceId=${this.deviceId}`);
    
    this.wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleRealtimeUpdate(data);
    };
  }

  // Submit detection data
  async submitDetection(detection: any, location: any, heading: number) {
    const payload = {
      deviceId: this.deviceId,
      detection,
      location,
      heading,
      timestamp: Date.now(),
    };

    // Send to backend
    const response = await fetch(`${API_BASE_URL}/detections`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });

    // Also send to existing cloud confirm
    cloudConfirmClient.enqueue({
      id: payload.detection.id,
      cls: payload.detection.class,
      bbox: payload.detection.bbox,
      conf: payload.detection.confidence,
      location: payload.location,
      heading: payload.heading,
    });

    return response.json();
  }

  // Background sync for offline capability
  async syncOfflineData() {
    const offlineDetections = await AsyncStorage.getItem('offline_detections');
    if (offlineDetections) {
      const detections = JSON.parse(offlineDetections);
      for (const detection of detections) {
        try {
          await this.submitDetection(detection.detection, detection.location, detection.heading);
        } catch (error) {
          console.warn('Failed to sync detection:', error);
        }
      }
      await AsyncStorage.removeItem('offline_detections');
    }
  }

  private handleRealtimeUpdate(data: any) {
    // Handle real-time traffic updates
    EventEmitter.emit('traffic_update', data);
  }

  private handleTrafficAlert(alertData: any) {
    // Handle push notification traffic alerts
    EventEmitter.emit('traffic_alert', alertData);
  }
}
