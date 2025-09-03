import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import DetectionOverlay from './DetectionOverlay';

interface Props {
  detections: any[];
  distance: number | null;
  lastCue: string;
  onDetectionsUpdate: (detections: any[]) => void;
  onDistanceUpdate: (distance: number | null) => void;
  policy: any;
  heading: number;
  location: any;
}

export default function DemoMode({
  detections,
  distance,
  lastCue,
  onDetectionsUpdate,
  onDistanceUpdate,
  policy,
  heading,
  location,
}: Props) {
  useEffect(() => {
    // Run detection check every 500ms for smooth updates
    const interval = setInterval(async () => {
      try {
        const {
          mockDetectionsOnce,
          estimateDistanceMeters,
        } = require('../ai/utils');
        const mockDetections = mockDetectionsOnce();

        onDetectionsUpdate(mockDetections);

        if (mockDetections.length > 0) {
          const best = mockDetections[0];
          const dist = estimateDistanceMeters(best.bbox);
          onDistanceUpdate(dist);

          // Feed to policy for voice cues
          if (policy) {
            policy.ingest({
              detections: mockDetections,
              heading,
              location,
              ts: Date.now(),
            });
          }
        } else {
          onDistanceUpdate(null);
        }
      } catch (error) {
        console.warn('Demo mode detection error:', error);
      }
    }, 500); // Check every 500ms for smooth animation

    return () => clearInterval(interval);
  }, [onDetectionsUpdate, onDistanceUpdate, policy, heading, location]);

  return (
    <View style={styles.container}>
      {/* Simulated driving view */}
      <View style={styles.mockCamera}>
        {/* Sky gradient */}
        <View style={styles.skyGradient} />

        {/* Road perspective */}
        <View style={styles.roadContainer}>
          {/* Road surface */}
          <View style={styles.roadSurface} />

          {/* Lane markings */}
          <View style={styles.laneMarkings}>
            {[...Array(8)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.laneMarking,
                  {
                    bottom: 80 + i * 25,
                    opacity: 0.8 - i * 0.08,
                    height: 8 - i * 0.8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Side barriers/buildings */}
          <View style={styles.leftBuildings} />
          <View style={styles.rightBuildings} />
        </View>

        {/* Horizon line */}
        <View style={styles.horizon} />

        {/* Demo status overlay */}
        <View style={styles.demoStatus}>
          <Text style={styles.demoTitle}>🚗 Traffic Assist</Text>
          <Text style={styles.demoSubtitle}>
            Demo Mode • Simulated Detection
          </Text>
        </View>
      </View>

      {/* Detection overlay */}
      <DetectionOverlay
        detections={detections}
        distance={distance}
        lastCue={lastCue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  mockCamera: {
    flex: 1,
    backgroundColor: '#87CEEB', // Sky blue
    position: 'relative',
  },
  skyGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: '#87CEEB',
  },
  roadContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  roadSurface: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: '#404040',
  },
  laneMarkings: {
    position: 'absolute',
    bottom: 0,
    left: '48%',
    right: '48%',
  },
  laneMarking: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    width: 4,
    left: '50%',
    marginLeft: -2,
  },
  leftBuildings: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '25%',
    height: '70%',
    backgroundColor: '#2c2c54',
  },
  rightBuildings: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '25%',
    height: '70%',
    backgroundColor: '#2c2c54',
  },
  horizon: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  demoStatus: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  demoTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  demoSubtitle: {
    color: '#aaaaaa',
    fontSize: 12,
    marginTop: 2,
  },
});
