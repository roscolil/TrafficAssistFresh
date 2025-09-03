import React, {useState, useEffect} from 'react';
import {View, ScrollView, Text, Dimensions} from 'react-native';
import {TrafficAssistTheme as theme} from '../theme/TrafficAssistTheme';
import {
  Card,
  Button,
  StatusIndicator,
  TrafficLight,
  MetricDisplay,
  Header,
} from './StyledComponents';

interface DashboardProps {
  isVisible: boolean;
  onClose: () => void;
  connectionStatus: 'online' | 'offline' | 'connecting';
  sessionData?: {
    detections: number;
    accuracy: number;
    uptime: number;
    dataTransferred: number;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({
  isVisible,
  onClose,
  connectionStatus,
  sessionData = {
    detections: 0,
    accuracy: 0.85,
    uptime: 0,
    dataTransferred: 0,
  },
}) => {
  const [realtimeMetrics, setRealtimeMetrics] = useState({
    fps: 30,
    latency: 45,
    batteryLevel: 85,
    signalStrength: -60,
  });

  useEffect(() => {
    if (isVisible) {
      // Simulate real-time metric updates
      const interval = setInterval(() => {
        setRealtimeMetrics(prev => ({
          fps: Math.max(15, Math.min(60, prev.fps + (Math.random() - 0.5) * 5)),
          latency: Math.max(
            20,
            Math.min(200, prev.latency + (Math.random() - 0.5) * 20),
          ),
          batteryLevel: Math.max(0, prev.batteryLevel - 0.01),
          signalStrength: Math.max(
            -100,
            Math.min(-30, prev.signalStrength + (Math.random() - 0.5) * 10),
          ),
        }));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDataSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.background,
        zIndex: 1000,
      }}>
      <Header
        title="Traffic Assist Dashboard"
        subtitle="Real-time Analytics"
        rightComponent={
          <Button
            title="Close"
            onPress={onClose}
            variant="secondary"
            size="sm"
          />
        }
      />

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{padding: theme.spacing.lg}}
        showsVerticalScrollIndicator={false}>
        {/* Status Overview */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            System Status
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <StatusIndicator
              status={connectionStatus}
              label={`Connection ${connectionStatus}`}
              size="lg"
            />

            <TrafficLight
              state={connectionStatus === 'online' ? 'green' : 'red'}
              confidence={connectionStatus === 'online' ? 0.95 : 0.0}
              size={45}
            />
          </View>
        </Card>

        {/* Real-time Metrics */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Performance Metrics
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}>
            <MetricDisplay
              label="Frame Rate"
              value={Math.round(realtimeMetrics.fps)}
              unit="fps"
              color={
                realtimeMetrics.fps > 25
                  ? theme.colors.success
                  : theme.colors.warning
              }
              trend={realtimeMetrics.fps > 25 ? 'up' : 'down'}
            />

            <MetricDisplay
              label="Latency"
              value={Math.round(realtimeMetrics.latency)}
              unit="ms"
              color={
                realtimeMetrics.latency < 100
                  ? theme.colors.success
                  : theme.colors.warning
              }
              trend={realtimeMetrics.latency < 100 ? 'up' : 'down'}
            />
          </View>
        </Card>

        {/* Session Statistics */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Session Statistics
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}>
            <View style={{width: '48%', marginBottom: theme.spacing.md}}>
              <MetricDisplay
                label="Detections"
                value={sessionData.detections}
                color={theme.colors.info}
              />
            </View>

            <View style={{width: '48%', marginBottom: theme.spacing.md}}>
              <MetricDisplay
                label="Accuracy"
                value={`${Math.round(sessionData.accuracy * 100)}`}
                unit="%"
                color={
                  sessionData.accuracy > 0.8
                    ? theme.colors.success
                    : theme.colors.warning
                }
              />
            </View>

            <View style={{width: '48%'}}>
              <MetricDisplay
                label="Uptime"
                value={formatUptime(sessionData.uptime)}
                color={theme.colors.textPrimary}
              />
            </View>

            <View style={{width: '48%'}}>
              <MetricDisplay
                label="Data Used"
                value={formatDataSize(sessionData.dataTransferred)}
                color={theme.colors.textSecondary}
              />
            </View>
          </View>
        </Card>

        {/* Device Status */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Device Status
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}>
            <MetricDisplay
              label="Battery"
              value={Math.round(realtimeMetrics.batteryLevel)}
              unit="%"
              color={
                realtimeMetrics.batteryLevel > 20
                  ? theme.colors.success
                  : theme.colors.error
              }
              trend={realtimeMetrics.batteryLevel > 50 ? 'up' : 'down'}
            />

            <MetricDisplay
              label="Signal"
              value={Math.round(realtimeMetrics.signalStrength)}
              unit="dBm"
              color={
                realtimeMetrics.signalStrength > -70
                  ? theme.colors.success
                  : theme.colors.warning
              }
              trend={realtimeMetrics.signalStrength > -70 ? 'up' : 'down'}
            />
          </View>
        </Card>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing.lg,
          }}>
          <Button
            title="Settings"
            onPress={() => {}}
            variant="secondary"
            style={{flex: 1, marginRight: theme.spacing.sm}}
          />

          <Button
            title="Export Data"
            onPress={() => {}}
            variant="primary"
            style={{flex: 1, marginLeft: theme.spacing.sm}}
          />
        </View>

        {/* Debug Info */}
        <Card variant="outlined" style={{marginTop: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              marginBottom: theme.spacing.sm,
            }}>
            Debug Information
          </Text>

          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.mono,
              lineHeight:
                theme.typography.lineHeight.relaxed *
                theme.typography.fontSize.xs,
            }}>
            Version: 1.0.0{'\n'}
            Build: development{'\n'}
            API: {connectionStatus === 'online' ? 'Connected' : 'Disconnected'}
            {'\n'}
            WebSocket: {connectionStatus === 'online' ? 'Active' : 'Inactive'}
            {'\n'}
            Environment: Development
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
};
