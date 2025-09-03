// Detection processor hook for real-time AI integration
import {useCallback, useRef} from 'react';
import {logInfo, logDebug, logWarn} from '../utils/logger';

interface DetectionResult {
  id: string;
  state: 'red' | 'yellow' | 'green' | 'unknown';
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized 0-1
  timestamp: number;
}

interface LocationData {
  lat: number;
  lng: number;
}

interface DetectionProcessor {
  processFrame: (frameData: any) => Promise<DetectionResult[]>;
  isProcessing: boolean;
}

export const useDetectionProcessor = (
  onDetection: (
    detection: DetectionResult,
    location: LocationData,
    heading: number,
  ) => void,
  location?: LocationData,
  heading?: number,
): DetectionProcessor => {
  const isProcessingRef = useRef(false);
  const lastProcessTimeRef = useRef(0);
  const frameCountRef = useRef(0);

  const processFrame = useCallback(
    async (frameData: any): Promise<DetectionResult[]> => {
      // Throttle processing to avoid overwhelming the system
      const now = Date.now();
      if (now - lastProcessTimeRef.current < 100) {
        // Max 10 FPS processing
        return [];
      }

      if (isProcessingRef.current) {
        return [];
      }

      isProcessingRef.current = true;
      lastProcessTimeRef.current = now;
      frameCountRef.current++;

      try {
        logDebug(
          'Processing frame',
          {frameCount: frameCountRef.current},
          'DetectionProcessor',
        );

        // Simulate AI processing time
        await new Promise(resolve => setTimeout(resolve, 50));

        // Mock detection logic - replace with real AI inference
        const detections: DetectionResult[] = [];

        // Randomly generate detections for testing (30% chance)
        if (Math.random() < 0.3) {
          const states: Array<'red' | 'yellow' | 'green'> = [
            'red',
            'yellow',
            'green',
          ];
          const state = states[Math.floor(Math.random() * states.length)];

          const detection: DetectionResult = {
            id: `detection_${now}_${Math.random().toString(36).substr(2, 9)}`,
            state,
            confidence: 0.75 + Math.random() * 0.25, // 75-100% confidence
            bbox: [
              0.2 + Math.random() * 0.6, // x: 20-80%
              0.1 + Math.random() * 0.5, // y: 10-60%
              0.05 + Math.random() * 0.15, // width: 5-20%
              0.05 + Math.random() * 0.15, // height: 5-20%
            ],
            timestamp: now,
          };

          detections.push(detection);

          // Call the detection handler if we have location data
          if (onDetection && location && typeof heading === 'number') {
            onDetection(detection, location, heading);
          }

          logInfo(
            'Detection generated',
            {
              state: detection.state,
              confidence: detection.confidence.toFixed(2),
            },
            'DetectionProcessor',
          );
        }

        return detections;
      } catch (error) {
        logWarn('Frame processing failed', error, 'DetectionProcessor');
        return [];
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onDetection, location, heading],
  );

  return {
    processFrame,
    isProcessing: isProcessingRef.current,
  };
};

// Export types for other components to use
export type {DetectionResult, LocationData, DetectionProcessor};
