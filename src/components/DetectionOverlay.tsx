import * as React from 'react';
import {View, Text, StyleSheet, Dimensions} from 'react-native';

type Detection = {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  state?: 'red' | 'amber' | 'green' | 'arrow';
};

interface Props {
  detections: Detection[];
  distance?: number | null;
  lastCue?: string;
}

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export default function DetectionOverlay({
  detections,
  distance,
  lastCue,
}: Props) {
  if (!detections || detections.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            🔍 Scanning for traffic lights...
          </Text>
        </View>
      </View>
    );
  }

  const trafficLights = detections.filter(d => d.cls === 'traffic_light');

  return (
    <View style={styles.container}>
      {/* Detection bounding boxes */}
      {trafficLights.map((detection, index) => {
        const [x1, y1, x2, y2] = detection.bbox;
        const left = x1 * SCREEN_WIDTH;
        const top = y1 * SCREEN_HEIGHT;
        const width = (x2 - x1) * SCREEN_WIDTH;
        const height = (y2 - y1) * SCREEN_HEIGHT;

        const color =
          detection.state === 'red'
            ? '#ff4444'
            : detection.state === 'green'
            ? '#44ff44'
            : detection.state === 'amber'
            ? '#ffaa44'
            : '#ffffff';

        return (
          <View
            key={index}
            style={[
              styles.boundingBox,
              {
                left,
                top,
                width,
                height,
                borderColor: color,
              },
            ]}>
            <View style={[styles.label, {backgroundColor: color}]}>
              <Text style={styles.labelText}>
                {detection.state?.toUpperCase()}{' '}
                {Math.round(detection.conf * 100)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Status information */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          🚦 {trafficLights.length} light{trafficLights.length !== 1 ? 's' : ''}{' '}
          detected
          {distance && ` • ${Math.round(distance)}m away`}
        </Text>
        {lastCue && <Text style={styles.cueText}>🔊 {lastCue}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 8,
  },
  label: {
    position: 'absolute',
    top: -30,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  labelText: {
    color: 'black',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cueText: {
    color: '#ffaa44',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
});
