/**
 * Backend Integration Service
 * Integrates the working iOS app with the existing backend infrastructure
 */

import EventEmitter from 'eventemitter3';
import {flags} from '../config/flags';
import {ConfirmRequest, cloudConfirmClient} from '../cloud/CloudConfirmClient';

export interface TrafficDetection {
  id: string;
  deviceId: string;
  location: {lat: number; lng: number};
  heading: number;
  timestamp: number;
  confidence: number;
  state: 'red' | 'yellow' | 'green' | 'unknown';
  bbox: [number, number, number, number];
}

export interface DeviceRegistration {
  platform: 'ios' | 'android' | 'web';
  userAgent: string;
  pushToken?: string;
  model?: string;
}

export interface BackendConfig {
  apiUrl: string;
  wsUrl?: string;
  enabled: boolean;
}

class BackendIntegrationService extends EventEmitter {
  private config: BackendConfig;
  private deviceId?: string;
  private userId?: string;
  private wsConnection?: WebSocket;
  private reconnectInterval?: NodeJS.Timeout;

  constructor() {
    super();

    // Initialize with environment-based configuration
    this.config = {
      apiUrl: this.getApiUrl(),
      wsUrl: this.getWebSocketUrl(),
      enabled: flags.backendIntegrationEnabled ?? true,
    };
  }

  private getApiUrl(): string {
    return flags.backendApiUrl;
  }

  private getWebSocketUrl(): string {
    return flags.backendWebSocketUrl;
  }

  /**
   * Initialize the backend service
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Backend integration disabled');
      return;
    }

    try {
      // Register device with backend (optional)
      if (flags.backendDeviceRegistrationEnabled) {
        await this.registerDevice();
      } else {
        console.log('Device registration disabled - using local mode');
        // Generate a local device ID for this session
        this.deviceId = `local_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      // Establish WebSocket connection for real-time updates (optional)
      if (flags.backendWebSocketEnabled) {
        this.connectWebSocket();
      } else {
        console.log('WebSocket connection disabled');
      }

      console.log('Backend integration initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Backend initialization failed:', error);

      // Don't throw - continue with local mode
      console.log('Falling back to local mode due to backend error');
      this.deviceId = `local_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      this.emit('initialized');
    }
  }

  /**
   * Register this device with the backend
   */
  private async registerDevice(): Promise<void> {
    const deviceInfo: DeviceRegistration = {
      platform: 'ios', // This will be dynamic based on platform
      userAgent: 'TrafficAssist/1.0.0',
      model: 'iOS Device', // Get from device info if available
    };

    const url = `${this.config.apiUrl}/api/devices/register`;
    console.log('Attempting device registration at:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceInfo),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Device registration failed (${response.status}):`,
          errorText,
        );

        // If we get HTML back, it's probably an error page
        if (errorText.startsWith('<')) {
          throw new Error(
            `Device registration returned HTML error page (${response.status}). API endpoint may not exist.`,
          );
        }

        throw new Error(
          `Device registration failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.deviceId = result.deviceId;
      this.userId = result.userId;

      console.log('Device registered successfully:', {
        deviceId: this.deviceId,
        userId: this.userId,
      });
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes('Network request failed')
      ) {
        console.error(
          'Network error during device registration - server may be unreachable:',
          this.config.apiUrl,
        );
        throw new Error(
          `Cannot connect to backend server at ${this.config.apiUrl}. Check if server is running.`,
        );
      }
      console.error('Device registration error:', error);
      throw error;
    }
  }

  /**
   * Submit traffic detection to backend
   */
  async submitDetection(detection: TrafficDetection): Promise<void> {
    if (!this.config.enabled) {
      console.log(
        'Backend integration disabled - skipping detection submission',
      );
      return;
    }

    // Check if backend detection submission is specifically enabled
    if (!flags.backendDeviceRegistrationEnabled) {
      console.log('Backend detection submission disabled - skipping');
      return;
    }

    if (!this.deviceId) {
      console.log('No device ID available - skipping detection submission');
      return;
    }

    try {
      // Submit to new backend API
      const backendPayload = {
        deviceId: this.deviceId,
        location: detection.location,
        heading: detection.heading,
        timestamp: detection.timestamp,
        confidence: detection.confidence,
        state: detection.state,
        bbox: detection.bbox,
      };

      const response = await fetch(`${this.config.apiUrl}/api/detections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendPayload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Detection submitted to backend:', result.detectionId);
        this.emit('detection_submitted', result);
      }

      // Also submit to existing cloud confirm service for compatibility
      const confirmRequest: ConfirmRequest = {
        id: detection.id,
        cls: 'traffic_light',
        bbox: detection.bbox,
        conf: detection.confidence,
        state:
          detection.state === 'yellow'
            ? 'amber'
            : detection.state === 'unknown'
            ? 'red'
            : (detection.state as 'red' | 'green' | 'amber' | 'arrow'),
        location: {lat: detection.location.lat, lon: detection.location.lng},
        heading: detection.heading,
      };

      cloudConfirmClient.enqueue(confirmRequest);
    } catch (error) {
      console.error('Failed to submit detection to backend:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get nearby traffic data from backend
   */
  async getNearbyTraffic(
    location: {lat: number; lng: number},
    radius: number = 1000,
  ): Promise<any[]> {
    if (!this.config.enabled) {
      console.log('Backend integration disabled, returning empty traffic data');
      return [];
    }

    // Check if backend traffic fetching is specifically enabled
    if (!flags.backendTrafficFetchEnabled) {
      console.log(
        'Backend traffic fetching disabled, returning empty traffic data',
      );
      return [];
    }

    const url = `${this.config.apiUrl}/api/traffic/nearby?lat=${location.lat}&lng=${location.lng}&radius=${radius}`;
    console.log('Fetching nearby traffic from:', url);

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Traffic API error (${response.status}):`, errorText);

        // If we get HTML back, it's probably an error page
        if (errorText.startsWith('<')) {
          throw new Error(
            `Traffic API returned HTML error page (${response.status}). Server may be down or URL incorrect.`,
          );
        }

        throw new Error(
          `Traffic API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log('Nearby traffic data received:', result);
      return result.traffic || [];
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(
          'Network error - server may be unreachable:',
          this.config.apiUrl,
        );
        throw new Error(
          `Cannot connect to traffic server at ${this.config.apiUrl}. Check if server is running.`,
        );
      }
      console.error('Failed to fetch nearby traffic:', error);
      throw error;
    }
  }

  /**
   * Establish WebSocket connection for real-time updates
   */
  private connectWebSocket(): void {
    if (!this.config.wsUrl) {
      return;
    }

    try {
      this.wsConnection = new WebSocket(this.config.wsUrl);

      this.wsConnection.onopen = () => {
        console.log('WebSocket connected');
        this.emit('websocket_connected');

        // Clear any existing reconnect interval
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = undefined;
        }
      };

      this.wsConnection.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('websocket_disconnected');
        this.scheduleReconnect();
      };

      this.wsConnection.onerror = error => {
        console.error('WebSocket error:', error);
        this.emit('websocket_error', error);
      };
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'traffic_update':
        this.emit('traffic_update', message.data);
        break;
      case 'alert':
        this.emit('alert', message.data);
        break;
      case 'system_status':
        this.emit('system_status', message.data);
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectInterval || !flags.backendWebSocketEnabled) {
      return;
    }

    this.reconnectInterval = setInterval(() => {
      if (
        flags.backendWebSocketEnabled &&
        (!this.wsConnection ||
          this.wsConnection.readyState === WebSocket.CLOSED)
      ) {
        console.log('Attempting WebSocket reconnection...');
        this.connectWebSocket();
      }
    }, 5000); // Reconnect every 5 seconds
  }

  /**
   * Subscribe to location-based updates
   */
  subscribeToLocation(location: {lat: number; lng: number}): void {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(
        JSON.stringify({
          type: 'subscribe_location',
          data: location,
        }),
      );
    }
  }

  /**
   * Submit analytics event
   */
  async submitAnalytics(event: {
    type: string;
    data: any;
    timestamp?: number;
  }): Promise<void> {
    if (!this.config.enabled) {
      console.log(
        'Backend integration disabled - skipping analytics submission',
      );
      return;
    }

    // Check if backend device registration is enabled (prerequisite for analytics)
    if (!flags.backendDeviceRegistrationEnabled) {
      console.log('Backend analytics submission disabled - skipping');
      return;
    }

    if (!this.deviceId) {
      console.log('No device ID available - skipping analytics submission');
      return;
    }

    try {
      const payload = {
        deviceId: this.deviceId,
        userId: this.userId,
        event: event.type,
        data: event.data,
        timestamp: event.timestamp || Date.now(),
      };

      await fetch(`${this.config.apiUrl}/api/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to submit analytics:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }

    this.removeAllListeners();
  }
}

export const backendIntegrationService = new BackendIntegrationService();
