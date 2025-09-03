// Web Backend Service Integration
import {Platform} from 'react-native';
import {logWarn, logInfo, logDebug} from '../utils/logger';

// Type declarations for cross-platform compatibility
declare const window: any;
declare const localStorage: any;
declare const navigator: any;
declare const screen: any;
declare type PushSubscription = any;

export class WebBackendService {
  private static instance: WebBackendService;
  private userId: string | null = null;
  private deviceId: string | null = null;
  private wsConnection: WebSocket | null = null;
  private swRegistration: any = null;

  static getInstance(): WebBackendService {
    if (!WebBackendService.instance) {
      WebBackendService.instance = new WebBackendService();
    }
    return WebBackendService.instance;
  }

  async initialize() {
    await this.loadStoredCredentials();
    await this.registerDevice();
    await this.setupServiceWorker();
    await this.connectRealtime();
  }

  private loadStoredCredentials() {
    this.userId = localStorage.getItem('user_id');
    this.deviceId = localStorage.getItem('device_id');
  }

  private async registerDevice() {
    const deviceInfo = {
      platform: Platform.OS || 'unknown',
      userAgent:
        Platform.OS === 'web' && typeof navigator !== 'undefined'
          ? navigator.userAgent
          : `React Native ${Platform.OS} ${Platform.Version}`,
      screen:
        Platform.OS === 'web' && typeof screen !== 'undefined'
          ? {
              width: screen.width,
              height: screen.height,
            }
          : {
              width: 0,
              height: 0,
            },
    };

    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/devices/register`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(deviceInfo),
      },
    );

    const data = await response.json();
    this.deviceId = data.deviceId;
    this.userId = data.userId;

    localStorage.setItem('device_id', this.deviceId);
    localStorage.setItem('user_id', this.userId);
  }

  // PWA Push Notifications
  private async setupServiceWorker() {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window !== 'undefined' &&
      'PushManager' in window
    ) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        logInfo(
          'Service worker registered successfully',
          undefined,
          'WebBackendService',
        );
        await this.subscribeToPush();
      } catch (error) {
        logWarn(
          'Service worker registration failed',
          error,
          'WebBackendService',
        );
        // Continue without service worker - not critical for basic functionality
      }
    } else {
      logDebug(
        'Service worker not supported or not in web environment',
        undefined,
        'WebBackendService',
      );
    }
  }

  private async subscribeToPush() {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY,
      });

      await this.updatePushSubscription(subscription);
    } catch (error) {
      logWarn('Push subscription failed', error, 'WebBackendService');
    }
  }

  private async updatePushSubscription(subscription: PushSubscription) {
    await fetch(
      `${process.env.REACT_APP_API_URL}/devices/${this.deviceId}/push-subscription`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(subscription),
      },
    );
  }

  // Real-time WebSocket connection
  private connectRealtime() {
    const wsUrl = `${process.env.REACT_APP_WS_URL}?deviceId=${this.deviceId}`;
    this.wsConnection = new WebSocket(wsUrl);

    this.wsConnection.onopen = () => {
      console.log('Connected to real-time service');
    };

    this.wsConnection.onmessage = event => {
      const data = JSON.parse(event.data);
      this.handleRealtimeUpdate(data);
    };

    this.wsConnection.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(() => this.connectRealtime(), 5000);
    };
  }

  // Submit detection with offline support
  async submitDetection(detection: any, location: any, heading: number) {
    const payload = {
      deviceId: this.deviceId,
      detection,
      location,
      heading,
      timestamp: Date.now(),
    };

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/detections`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error('Network error');

      return await response.json();
    } catch (error) {
      // Store for offline sync
      this.storeOfflineDetection(payload);
      throw error;
    }
  }

  private storeOfflineDetection(detection: any) {
    const offline = JSON.parse(
      localStorage.getItem('offline_detections') || '[]',
    );
    offline.push(detection);
    localStorage.setItem('offline_detections', JSON.stringify(offline));
  }

  // Sync offline data when connection restored
  async syncOfflineData() {
    const offlineDetections = JSON.parse(
      localStorage.getItem('offline_detections') || '[]',
    );

    for (const detection of offlineDetections) {
      try {
        await this.submitDetection(
          detection.detection,
          detection.location,
          detection.heading,
        );
      } catch (error) {
        console.warn('Failed to sync detection:', error);
        return; // Stop syncing if still offline
      }
    }

    localStorage.removeItem('offline_detections');
  }

  // Analytics and telemetry
  async trackEvent(eventName: string, properties: any = {}) {
    const event = {
      name: eventName,
      properties: {
        ...properties,
        deviceId: this.deviceId,
        timestamp: Date.now(),
        url:
          Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          window.location
            ? window.location.href
            : 'mobile://app',
      },
    };

    try {
      await fetch(`${process.env.REACT_APP_API_URL}/analytics/events`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  private handleRealtimeUpdate(data: any) {
    // Dispatch custom events for the app to handle
    window.dispatchEvent(new CustomEvent('traffic_update', {detail: data}));
  }

  // Get nearby traffic data
  async getNearbyTraffic(
    location: {lat: number; lng: number},
    radius: number = 1000,
  ) {
    const params = new URLSearchParams({
      lat: location.lat.toString(),
      lng: location.lng.toString(),
      radius: radius.toString(),
    });

    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/traffic/nearby?${params}`,
    );
    return await response.json();
  }

  // User preferences
  async updatePreferences(preferences: any) {
    await fetch(
      `${process.env.REACT_APP_API_URL}/users/${this.userId}/preferences`,
      {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(preferences),
      },
    );
  }

  async getPreferences() {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/users/${this.userId}/preferences`,
    );
    return await response.json();
  }
}
