/**
 * Enhanced Detection Hook with Backend Integration
 * Combines local AI detection with backend data and real-time updates
 */

import {useState, useEffect, useCallback} from 'react';
import {mockDetectionsOnce, Detection} from '../ai/utils';
import {
  backendIntegrationService,
  TrafficDetection,
} from '../services/BackendIntegrationService';
import {getCurrentLocation, LocationData} from '../sensors/location';
import {flags} from '../config/flags';

// Simple UUID v4 generator that works in React Native
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface EnhancedDetection {
  id: string;
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  state?: 'red' | 'amber' | 'green' | 'arrow' | 'unknown'; // Extended state type
  timestamp: number;
  source: 'local' | 'backend' | 'realtime';
  location?: {lat: number; lng: number};
  distance?: number; // Distance from current location in meters
}

export function useEnhancedDetections() {
  const [detections, setDetections] = useState<EnhancedDetection[]>([]);
  const [backendDetections, setBackendDetections] = useState<
    EnhancedDetection[]
  >([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(
    null,
  );
  const [backendConnected, setBackendConnected] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);

  // Initialize backend service
  useEffect(() => {
    if (flags.backendIntegrationEnabled) {
      backendIntegrationService.initialize();

      // Listen for backend events
      const handleBackendConnected = () => setBackendConnected(true);
      const handleBackendDisconnected = () => setBackendConnected(false);
      const handleTrafficUpdate = (data: any) => {
        updateBackendDetections(data);
      };

      backendIntegrationService.on('initialized', handleBackendConnected);
      backendIntegrationService.on(
        'websocket_connected',
        handleBackendConnected,
      );
      backendIntegrationService.on(
        'websocket_disconnected',
        handleBackendDisconnected,
      );
      backendIntegrationService.on('traffic_update', handleTrafficUpdate);

      return () => {
        backendIntegrationService.off('initialized', handleBackendConnected);
        backendIntegrationService.off(
          'websocket_connected',
          handleBackendConnected,
        );
        backendIntegrationService.off(
          'websocket_disconnected',
          handleBackendDisconnected,
        );
        backendIntegrationService.off('traffic_update', handleTrafficUpdate);
      };
    }
  }, []);

  // Get current location and subscribe to location-based updates
  useEffect(() => {
    const updateLocation = async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);

        // Subscribe to backend updates for this location
        if (flags.backendIntegrationEnabled && location) {
          backendIntegrationService.subscribeToLocation({
            lat: location.latitude,
            lng: location.longitude,
          });

          // Fetch nearby traffic data (only if enabled)
          if (flags.backendTrafficFetchEnabled) {
            try {
              const nearbyTraffic =
                await backendIntegrationService.getNearbyTraffic({
                  lat: location.latitude,
                  lng: location.longitude,
                });

              if (nearbyTraffic.length > 0) {
                const nearbyDetections = nearbyTraffic.map(traffic => ({
                  id: traffic.id,
                  cls: 'traffic_light',
                  conf: traffic.confidence || 0.8,
                  bbox: traffic.bbox || [0.4, 0.1, 0.6, 0.3],
                  state: traffic.state,
                  timestamp: new Date(traffic.updated_at).getTime(),
                  source: 'backend' as const,
                  location: {
                    lat: traffic.location.lat,
                    lng: traffic.location.lng,
                  },
                  distance: calculateDistance(
                    {lat: location.latitude, lng: location.longitude},
                    traffic.location,
                  ),
                }));

                setBackendDetections(nearbyDetections);
              }
            } catch (trafficError) {
              console.warn('Failed to fetch nearby traffic:', trafficError);
              // Don't throw - continue with local detections only
            }
          } else {
            console.log(
              'Backend traffic fetching disabled - using local detections only',
            );
          }
        }
      } catch (error) {
        console.error('Failed to get location:', error);
      }
    };

    updateLocation();
    const locationInterval = setInterval(updateLocation, 10000); // Update every 10 seconds

    return () => clearInterval(locationInterval);
  }, []);

  // Local AI detection (demo mode)
  useEffect(() => {
    const detectionsInterval = setInterval(() => {
      const localDetections = mockDetectionsOnce().map(detection => ({
        ...detection,
        id: generateUUID(),
        timestamp: Date.now(),
        source: 'local' as const,
        location: currentLocation
          ? {
              lat: currentLocation.latitude,
              lng: currentLocation.longitude,
            }
          : undefined,
      }));

      setDetections(localDetections);

      // Submit significant detections to backend
      submitToBackend(localDetections);
    }, 500); // Keep original demo timing

    return () => clearInterval(detectionsInterval);
  }, [currentLocation]);

  // Submit detections to backend with rate limiting
  const submitToBackend = useCallback(
    async (localDetections: EnhancedDetection[]) => {
      if (!flags.backendIntegrationEnabled || !currentLocation) {
        return;
      }

      // Check if backend device registration is enabled (required for submissions)
      if (!flags.backendDeviceRegistrationEnabled) {
        console.log(
          'Backend device registration disabled - skipping backend submissions',
        );
        return;
      }

      const now = Date.now();
      // Rate limit submissions (max every 2 seconds for significant detections)
      if (now - lastSubmissionTime < 2000) {
        return;
      }

      // Only submit high-confidence detections
      const significantDetections = localDetections.filter(
        detection => detection.conf > 0.75 && detection.state !== 'unknown',
      );

      if (significantDetections.length === 0) {
        return;
      }

      try {
        for (const detection of significantDetections) {
          const trafficDetection: TrafficDetection = {
            id: detection.id,
            deviceId: '', // Will be set by backend service
            location: {
              lat: currentLocation.latitude,
              lng: currentLocation.longitude,
            },
            heading: currentLocation.heading || 0,
            timestamp: detection.timestamp,
            confidence: detection.conf,
            state:
              detection.state === 'amber'
                ? 'yellow'
                : (detection.state as any) || 'unknown',
            bbox: detection.bbox,
          };

          await backendIntegrationService.submitDetection(trafficDetection);
        }

        setLastSubmissionTime(now);

        // Submit analytics
        await backendIntegrationService.submitAnalytics({
          type: 'detections_submitted',
          data: {
            count: significantDetections.length,
            location: currentLocation,
            averageConfidence:
              significantDetections.reduce((sum, d) => sum + d.conf, 0) /
              significantDetections.length,
          },
        });
      } catch (error) {
        console.error('Failed to submit detections to backend:', error);
      }
    },
    [currentLocation, lastSubmissionTime],
  );

  // Update backend detections from real-time updates
  const updateBackendDetections = useCallback(
    (updateData: any) => {
      if (updateData.type === 'detection' && updateData.data) {
        const newDetection: EnhancedDetection = {
          id: updateData.data.id || generateUUID(),
          cls: 'traffic_light',
          conf: updateData.data.confidence || 0.8,
          bbox: updateData.data.bbox || [0.4, 0.1, 0.6, 0.3],
          state: updateData.data.state,
          timestamp: updateData.timestamp || Date.now(),
          source: 'realtime',
          location: updateData.data.location,
          distance: currentLocation
            ? calculateDistance(
                {lat: currentLocation.latitude, lng: currentLocation.longitude},
                updateData.data.location,
              )
            : undefined,
        };

        setBackendDetections(prev => {
          const filtered = prev.filter(d => d.id !== newDetection.id);
          return [...filtered, newDetection].slice(-5); // Keep last 5 backend detections
        });
      }
    },
    [currentLocation],
  );

  // Merge local and backend detections, prioritizing local for immediate feedback
  const mergedDetections = [
    ...detections,
    ...backendDetections.filter(bd => bd.distance && bd.distance < 500),
  ];

  return {
    detections: mergedDetections,
    localDetections: detections,
    backendDetections,
    backendConnected,
    currentLocation,
    submitAnalytics: backendIntegrationService.submitAnalytics.bind(
      backendIntegrationService,
    ),
  };
}

// Helper function to calculate distance between two points
function calculateDistance(
  point1: {lat: number; lng: number},
  point2: {lat: number; lng: number},
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
