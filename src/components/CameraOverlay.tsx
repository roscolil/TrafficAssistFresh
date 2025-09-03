import * as React from 'react';
import {View, Text} from 'react-native';
import {TrafficAssistTheme as theme} from '../theme/TrafficAssistTheme';
import {TrafficLight} from './StyledComponents';

interface CameraOverlayProps {
  detections?: Array<{
    id: string;
    state: 'red' | 'yellow' | 'green' | 'unknown';
    confidence: number;
    bbox: [number, number, number, number];
  }>;
  connectionStatus: 'online' | 'offline' | 'connecting';
  metrics?: {
    fps: number;
    detectionCount: number;
    accuracy: number;
  };
  style?: any;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  detections = [],
  connectionStatus,
  metrics,
  style,
}) => {
  return (
    <View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        },
        style,
      ]}>
      {/* Detection Overlays */}
      {detections.map(detection => (
        <DetectionBox key={detection.id} detection={detection} />
      ))}

      {/* Detection Count Indicator */}
      {detections.length > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            right: theme.spacing.lg,
            backgroundColor: theme.colors.overlay,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.borderRadius.sm,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.colors.success,
              marginRight: theme.spacing.xs,
            }}
          />
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.semibold,
            }}>
            {detections.length} detected
          </Text>
        </View>
      )}

      {/* Traffic Light Status */}
      {/* {detections.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 200,
            right: theme.spacing.lg,
            backgroundColor: theme.colors.overlay,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.md,
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              marginBottom: theme.spacing.sm,
            }}>
            Current State
          </Text>
          <TrafficLight
            state={detections[0].state}
            confidence={detections[0].confidence}
            size={50}
          />
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              marginTop: theme.spacing.sm,
              textTransform: 'capitalize',
            }}>
            {detections[0].state}
          </Text>
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.xs,
            }}>
            {Math.round(detections[0].confidence * 100)}% confidence
          </Text>
        </View>
      )} */}
    </View>
  );
};

// Detection Box Component
interface DetectionBoxProps {
  detection: {
    id: string;
    state: 'red' | 'yellow' | 'green' | 'unknown';
    confidence: number;
    bbox: [number, number, number, number];
  };
}

const DetectionBox: React.FC<DetectionBoxProps> = ({detection}) => {
  const getDetectionColor = () => {
    switch (detection.state) {
      case 'red':
        return theme.colors.trafficRed;
      case 'yellow':
        return theme.colors.trafficYellow;
      case 'green':
        return theme.colors.trafficGreen;
      default:
        return theme.colors.detectionBox;
    }
  };

  const getConfidenceColor = () => {
    if (detection.confidence > 0.8) return theme.colors.confidenceHigh;
    if (detection.confidence > 0.5) return theme.colors.confidenceMedium;
    return theme.colors.confidenceLow;
  };

  // Convert normalized bbox to screen coordinates
  // This would need to be adjusted based on your actual camera dimensions
  const [x, y, width, height] = detection.bbox;

  return (
    <View
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        borderWidth: 2,
        borderColor: getDetectionColor(),
        borderRadius: theme.borderRadius.sm,
        backgroundColor: 'transparent',
      }}>
      {/* Detection Label */}
      <View
        style={{
          position: 'absolute',
          top: -30,
          left: 0,
          backgroundColor: getDetectionColor(),
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 2,
          borderRadius: theme.borderRadius.sm,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            textTransform: 'uppercase',
          }}>
          {detection.state}
        </Text>
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: getConfidenceColor(),
            marginLeft: theme.spacing.xs,
          }}
        />
      </View>
    </View>
  );
};
