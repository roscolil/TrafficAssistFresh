import {Platform} from 'react-native';
import {cloudConfirmClient} from '../cloud/CloudConfirmClient';
import {getBackendConfig, BackendConfig as ConfigType} from './config';
import {logWarn, logInfo, logDebug} from '../utils/logger';
import {flags} from '../config/flags';

// Type declarations for cross-platform compatibility
declare const window: any;
declare const navigator: any;
declare const localStorage: any;

interface InitConfig {
  apiUrl: string;
  wsUrl: string;
  environment: 'web' | 'ios' | 'android';
  enableWebSocket?: boolean; // Optional flag to control WebSocket connection
}

class UnifiedBackendClient {
  private static instance: UnifiedBackendClient;
  private config: ConfigType | null = null;
  private deviceId: string | null = null;
  private userId: string | null = null;
  private wsConnection: WebSocket | null = null;
  private enableWebSocket: boolean = true;

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
    this.enableWebSocket = config.enableWebSocket !== false; // Default to true unless explicitly disabled
    this.loadCredentials();
    this.registerDevice();

    if (this.enableWebSocket) {
      this.connectRealtime();
    } else {
      logInfo(
        'WebSocket connection disabled by configuration',
        undefined,
        'UnifiedBackendClient',
      );
    }
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

    // Check if backend device registration is enabled
    if (!flags.backendDeviceRegistrationEnabled) {
      logInfo(
        'Device registration disabled by feature flag',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

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
      logWarn('Device registration failed', error, 'UnifiedBackendClient');
    }
  }

  private connectRealtime() {
    if (!this.enableWebSocket) {
      logInfo(
        'WebSocket connection disabled by client config',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

    // Check if backend WebSocket is enabled via feature flags
    if (!flags.backendWebSocketEnabled) {
      logInfo(
        'WebSocket connection disabled by feature flag',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

    if (!this.config || !this.config.wsUrl || !this.deviceId) {
      logInfo(
        'Skipping WebSocket connection - missing config or deviceId',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

    try {
      const wsUrl = `${this.config.wsUrl}?deviceId=${this.deviceId}`;
      logInfo(
        `Attempting WebSocket connection to: ${wsUrl}`,
        undefined,
        'UnifiedBackendClient',
      );

      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        logInfo(
          'Connected to real-time backend',
          undefined,
          'UnifiedBackendClient',
        );
      };

      this.wsConnection.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeMessage(data);
        } catch (error) {
          logWarn(
            'Failed to parse WebSocket message',
            error,
            'UnifiedBackendClient',
          );
        }
      };

      this.wsConnection.onclose = event => {
        const reason = event.reason || 'Unknown reason';
        const code = event.code || 'Unknown code';
        logInfo(
          `Disconnected from real-time backend - Code: ${code}, Reason: ${reason}`,
          undefined,
          'UnifiedBackendClient',
        );
        // Only attempt to reconnect if the close wasn't intentional and WebSocket is still enabled
        if (
          event.code !== 1000 &&
          this.enableWebSocket &&
          flags.backendWebSocketEnabled
        ) {
          logInfo(
            'Attempting to reconnect in 5 seconds...',
            undefined,
            'UnifiedBackendClient',
          );
          setTimeout(() => this.connectRealtime(), 5000);
        }
      };

      this.wsConnection.onerror = error => {
        logWarn('WebSocket connection error', error, 'UnifiedBackendClient');
      };
    } catch (error) {
      logWarn('WebSocket connection failed', error, 'UnifiedBackendClient');
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
    // Check if backend device registration is enabled (required for detection submission)
    if (!flags.backendDeviceRegistrationEnabled) {
      logInfo(
        'Backend device registration disabled - skipping detection submission',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

    if (!this.deviceId) {
      logWarn(
        'Device not registered, cannot submit detection',
        undefined,
        'UnifiedBackendClient',
      );
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
      logWarn('Backend submission failed', error, 'UnifiedBackendClient');
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
      logWarn('Cloud confirm submission failed', error, 'UnifiedBackendClient');
    }
  }

  subscribeToLocation(location: {lat: number; lng: number}) {
    if (!this.enableWebSocket) {
      logDebug(
        'WebSocket disabled - location subscription skipped',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(
        JSON.stringify({
          type: 'subscribe_location',
          location: location,
        }),
      );
    } else {
      logDebug(
        'WebSocket not connected - location subscription skipped',
        undefined,
        'UnifiedBackendClient',
      );
    }
  }

  async getNearbyTraffic(location: any, radius: number = 1000): Promise<any> {
    if (!this.config) throw new Error('Backend client not initialized');

    // Check if backend traffic fetching is enabled
    if (!flags.backendTrafficFetchEnabled) {
      logInfo(
        'Backend traffic fetching disabled by feature flag',
        undefined,
        'UnifiedBackendClient',
      );
      return [];
    }

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
    if (!this.config) return;

    // Check if backend device registration is enabled (required for analytics)
    if (!flags.backendDeviceRegistrationEnabled) {
      logInfo(
        'Backend device registration disabled - skipping analytics tracking',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

    if (!this.deviceId) {
      logInfo(
        'Device not registered - skipping analytics tracking',
        undefined,
        'UnifiedBackendClient',
      );
      return;
    }

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
      logWarn('Analytics tracking failed', error, 'UnifiedBackendClient');
    }
  }

  // Get connection status for UI components
  getConnectionStatus(): 'online' | 'offline' | 'connecting' {
    if (!this.enableWebSocket) {
      // When WebSocket is disabled, consider it offline for real-time features
      // but the API could still be accessible
      return 'offline';
    }

    if (!this.wsConnection) {
      return 'offline';
    }

    switch (this.wsConnection.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'online';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
      default:
        return 'offline';
    }
  }

  // Check if backend API is accessible
  async checkApiHealth(): Promise<boolean> {
    if (!this.config) return false;

    try {
      const response = await fetch(`${this.config.apiUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      } as any);
      return response.ok;
    } catch (error) {
      logWarn('API health check failed', error, 'UnifiedBackendClient');
      return false;
    }
  }
}

export const backendClient = UnifiedBackendClient.getInstance();

// Auto-initialize for web environment only if backend integration is enabled
if (
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  flags.backendIntegrationEnabled
) {
  // Web environment - get config from our config system
  const config = getBackendConfig();
  backendClient.initialize({
    apiUrl: config.apiUrl,
    wsUrl: config.wsUrl,
    environment: 'web',
    enableWebSocket: flags.backendWebSocketEnabled, // Use feature flag for WebSocket
  });
} else {
  logInfo(
    'Backend integration disabled or not in web environment - skipping auto-initialization',
    undefined,
    'UnifiedBackendClient',
  );
}

export default UnifiedBackendClient;
