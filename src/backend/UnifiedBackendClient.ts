// Unified Backend Client for both Web and Mobile
import {cloudConfirmClient} from '../cloud/CloudConfirmClient';
import {getBackendConfig, BackendConfig as ConfigType} from './config';

// Type declarations for cross-platform compatibility
declare const window: any;
declare const navigator: any;
declare const localStorage: any;

interface InitConfig {
  apiUrl: string;
  wsUrl: string;
  environment: 'web' | 'ios' | 'android';
}

class UnifiedBackendClient {
  private static instance: UnifiedBackendClient;
  private config: ConfigType | null = null;
  private deviceId: string | null = null;
  private userId: string | null = null;
  private wsConnection: WebSocket | null = null;

  static getInstance(): UnifiedBackendClient {
    if (!UnifiedBackendClient.instance) {
      UnifiedBackendClient.instance = new UnifiedBackendClient();
    }
    return UnifiedBackendClient.instance;
  }

  initialize(config: InitConfig) {
    this.config = {
      apiUrl: config.apiUrl,
      wsUrl: config.wsUrl,
      environment: config.environment,
    };
    this.loadCredentials();
    this.registerDevice();
    this.connectRealtime();
  }

  private loadCredentials() {
    if (!this.config) return;

    if (this.config.environment === 'web') {
      // Web environment
      if (typeof localStorage !== 'undefined') {
        this.deviceId = localStorage.getItem('traffic_assist_device_id');
        this.userId = localStorage.getItem('traffic_assist_user_id');
      }
    } else {
      // Mobile environment - you'd use AsyncStorage here
      // For now, use in-memory storage
      this.deviceId = null;
      this.userId = null;
    }
  }

  private async registerDevice() {
    if (!this.config) return;
    if (this.deviceId && this.userId) return;

    try {
      const deviceInfo = {
        platform: this.config.environment,
        timestamp: Date.now(),
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      };

      const response = await fetch(
        `${this.config.apiUrl}/api/devices/register`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(deviceInfo),
        },
      );

      if (response.ok) {
        const data = await response.json();
        this.deviceId = data.deviceId;
        this.userId = data.userId;

        // Store credentials
        if (
          this.config.environment === 'web' &&
          typeof localStorage !== 'undefined'
        ) {
          localStorage.setItem('traffic_assist_device_id', this.deviceId);
          localStorage.setItem('traffic_assist_user_id', this.userId);
        }
      }
    } catch (error) {
      console.warn('Device registration failed:', error);
    }
  }

  private connectRealtime() {
    if (!this.config || !this.config.wsUrl || !this.deviceId) return;

    try {
      this.wsConnection = new WebSocket(
        `${this.config.wsUrl}?deviceId=${this.deviceId}`,
      );

      this.wsConnection.onopen = () => {
        console.log('Connected to real-time backend');
      };

      this.wsConnection.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeMessage(data);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Disconnected from real-time backend');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectRealtime(), 5000);
      };
    } catch (error) {
      console.warn('WebSocket connection failed:', error);
    }
  }

  private handleRealtimeMessage(data: any) {
    switch (data.type) {
      case 'traffic_update':
        this.emitEvent('traffic_update', data.payload);
        break;
      case 'alert':
        this.emitEvent('traffic_alert', data.payload);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  async submitDetection(detection: any, location: any, heading: number) {
    if (!this.deviceId) {
      console.warn('Device not registered, cannot submit detection');
      return;
    }

    const payload = {
      deviceId: this.deviceId,
      detection,
      location,
      heading,
      timestamp: Date.now(),
    };

    try {
      // Send to new backend
      if (!this.config) throw new Error('Backend client not initialized');

      const response = await fetch(`${this.config.apiUrl}/api/detections`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Detection submitted to backend:', result);
      }
    } catch (error) {
      console.warn('Backend submission failed:', error);
    }

    // Also send to existing cloud confirm service
    try {
      cloudConfirmClient.enqueue({
        id: detection.id || `det_${Date.now()}`,
        cls: detection.class || 'traffic_light',
        bbox: detection.bbox || [0, 0, 0, 0],
        conf: detection.confidence || 0.5,
        state: detection.state,
        location: location,
        heading: heading,
      });
    } catch (error) {
      console.warn('Cloud confirm submission failed:', error);
    }
  }

  subscribeToLocation(location: {lat: number; lng: number}) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(
        JSON.stringify({
          type: 'subscribe_location',
          location: location,
        }),
      );
    }
  }

  async getNearbyTraffic(location: any, radius: number = 1000): Promise<any> {
    if (!this.config) throw new Error('Backend client not initialized');

    try {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        radius: radius.toString(),
      });

      const response = await fetch(
        `${this.config.apiUrl}/api/traffic/nearby?${params}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch nearby traffic:', error);
    }
    return [];
  }

  private emitEvent(eventName: string, data: any) {
    if (!this.config) return;

    if (this.config.environment === 'web') {
      // Web environment - use CustomEvent
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventName, {detail: data}));
      }
    } else {
      // Mobile environment - use EventEmitter or similar
      console.log(`Event: ${eventName}`, data);
    }
  }

  // Analytics
  async trackEvent(eventName: string, properties: any = {}) {
    if (!this.config || !this.deviceId) return;

    try {
      await fetch(`${this.config.apiUrl}/api/analytics/events`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          deviceId: this.deviceId,
          eventName,
          properties: {
            ...properties,
            timestamp: Date.now(),
            environment: this.config.environment,
          },
        }),
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }
}

export const backendClient = UnifiedBackendClient.getInstance();

// Auto-initialize for web environment
if (typeof window !== 'undefined') {
  // Web environment - get config from our config system
  const config = getBackendConfig();
  backendClient.initialize({
    apiUrl: config.apiUrl,
    wsUrl: config.wsUrl,
    environment: 'web',
  });
}

export default UnifiedBackendClient;
