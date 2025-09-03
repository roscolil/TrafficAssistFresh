import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {flags} from './config/flags';
import {backendClient} from './backend/UnifiedBackendClient';
import {TrafficAssistTheme as theme} from './theme/TrafficAssistTheme';
import {CameraOverlay} from './components/CameraOverlay';
import {Dashboard} from './components/Dashboard';
import {Settings} from './components/Settings';
import {Button} from './components/StyledComponents';
import {
  WebAdaptation,
  LoadingScreen,
  ErrorBoundary,
} from './components/WebAdaptation';
import {logWarn, logInfo, logDebug} from './utils/logger';
import {useEnhancedDetections} from './hooks/useEnhancedDetections';

// Initialize speech synthesis
try {
  const {initSpeech} = require('./voice/speech');
  initSpeech();
  logInfo('Speech synthesis initialized', undefined, 'App');
} catch (error) {
  logWarn('Failed to initialize speech synthesis', error, 'App');
}

// Re-enable native modules gradually for testing
const ENABLE_NATIVE_MODULES = true;
const ENABLE_CAMERA = true; // Re-enable camera with safer version
const ENABLE_CONNECTIVITY_CHECK = true;

// Safe import for KeepAwake
let KeepAwake: any = () => null; // Default to no-op component
if (ENABLE_NATIVE_MODULES) {
  try {
    const keepAwakeModule = require('react-native-keep-awake');
    KeepAwake =
      keepAwakeModule.default ||
      keepAwakeModule.KeepAwake ||
      keepAwakeModule ||
      (() => null);
  } catch (error) {
    logWarn('KeepAwake module not available', error, 'App');
    KeepAwake = () => null;
  }
}

// Safe imports for components
let CameraView: any = MinimalCameraView;
let ConnectivityCheck: any = MinimalConnectivityCheck;

if (ENABLE_CAMERA) {
  try {
    const cameraModule = require('./camera/CameraView');
    CameraView =
      cameraModule.default ||
      cameraModule.CameraView ||
      cameraModule ||
      MinimalCameraView;
  } catch (error) {
    logWarn('CameraView not available', error, 'App');
    CameraView = MinimalCameraView;
  }
}

if (ENABLE_CONNECTIVITY_CHECK) {
  try {
    const connectivityModule = require('./dev/ConnectivityCheck');
    ConnectivityCheck =
      connectivityModule.default ||
      connectivityModule.ConnectivityCheck ||
      connectivityModule ||
      MinimalConnectivityCheck;
  } catch (error) {
    logWarn('ConnectivityCheck not available', error, 'App');
    ConnectivityCheck = MinimalConnectivityCheck;
  }
}

// Minimal CameraView fallback
function MinimalCameraView() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Text style={{color: 'white', textAlign: 'center', padding: 20}}>
        Camera View Disabled for Testing{'\n'}
        (Enable ENABLE_CAMERA to restore functionality)
      </Text>
    </View>
  );
}

// Minimal ConnectivityCheck fallback
function MinimalConnectivityCheck() {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 12,
        borderRadius: 12,
      }}>
      <Text style={{color: 'white', fontWeight: '600'}}>
        Connectivity Check Disabled
      </Text>
    </View>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'online' | 'offline' | 'connecting'
  >('connecting');

  // Use enhanced detections with backend integration
  const {
    detections: rawDetections,
    localDetections,
    backendDetections,
    backendConnected,
    currentLocation,
    submitAnalytics,
  } = useEnhancedDetections();

  // Map enhanced detections to camera overlay format
  const detections = rawDetections.map(detection => ({
    id: detection.id,
    state:
      detection.state === 'amber'
        ? 'yellow'
        : ((detection.state === 'arrow'
            ? 'green'
            : detection.state || 'unknown') as
            | 'red'
            | 'yellow'
            | 'green'
            | 'unknown'),
    confidence: detection.conf,
    bbox: detection.bbox,
  }));

  const [sessionData, setSessionData] = useState({
    detections: 0,
    accuracy: 0.85,
    uptime: 0,
    dataTransferred: 1024 * 1024 * 2.5, // 2.5 MB
  });
  const [settings, setSettings] = useState({
    notifications: true,
    highAccuracyMode: false,
    saveDetections: true,
    autoUpload: false,
    soundAlerts: true,
    vibrationFeedback: true,
    darkMode: true,
    dataCompression: true,
  });

  // Initialize app and connection status
  useEffect(() => {
    async function initializeApp() {
      try {
        setIsLoading(true);
        setConnectionStatus('connecting');

        // Wait a moment for backend client to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get initial connection status from backend client
        const status = backendClient.getConnectionStatus();
        setConnectionStatus(status);

        // Set up periodic status checks
        const statusInterval = setInterval(() => {
          const currentStatus = backendClient.getConnectionStatus();
          setConnectionStatus(currentStatus);
        }, 5000); // Check every 5 seconds

        setIsLoading(false);

        return () => clearInterval(statusInterval);
      } catch (error) {
        logWarn('App initialization failed', error, 'App');
        setConnectionStatus('offline');
        setIsLoading(false);
      }
    }

    initializeApp();
  }, []);

  // Initialize the backend service and setup session tracking
  useEffect(() => {
    if (rawDetections.length === 0) return; // Don't update if no detections

    const newDetectionCount = rawDetections.length;
    const newAccuracy =
      rawDetections.reduce((sum, d) => sum + d.conf, 0) / rawDetections.length;

    setSessionData(prev => {
      // Only update if values actually changed to prevent infinite loops
      if (
        prev.detections === newDetectionCount &&
        Math.abs(prev.accuracy - newAccuracy) < 0.01
      ) {
        return prev;
      }

      return {
        ...prev,
        detections: newDetectionCount,
        accuracy: newAccuracy,
      };
    });
  }, [rawDetections.length]); // Only depend on length, not the entire array

  // Manual analysis trigger for testing
  const handleAnalyze = async () => {
    try {
      logInfo('Manual analysis triggered', undefined, 'App');

      if (submitAnalytics) {
        await submitAnalytics({
          type: 'manual_analysis',
          data: {
            timestamp: Date.now(),
            location: currentLocation,
          },
        });
      }

      logInfo('Manual analysis completed', undefined, 'App');
    } catch (error) {
      logWarn('Manual analysis failed', error, 'App');
    }
  };

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({...prev, [key]: value}));
  };

  if (isLoading) {
    return (
      <ErrorBoundary>
        <LoadingScreen message="Connecting to Traffic Assist services..." />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <WebAdaptation>
        {Platform.OS === 'web' ? (
          <View style={{flex: 1, backgroundColor: theme.colors.background}}>
            <StatusBar
              barStyle="light-content"
              backgroundColor={theme.colors.background}
            />
            <KeepAwake />

            {/* Camera Section - Top 2/3 */}
            <View style={{flex: 2, position: 'relative'}}>
              <CameraView />

              {/* Camera Overlay on top of camera */}
              <CameraOverlay
                detections={detections}
                connectionStatus={connectionStatus}
                metrics={{
                  fps: 30,
                  detectionCount: sessionData.detections,
                  accuracy: sessionData.accuracy,
                }}
              />
            </View>

            {/* Controls Section - Bottom 1/3 */}
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingTop: theme.spacing.lg,
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.xl,
              }}>
              {/* Connection Status Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: theme.colors.surfaceLight,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.borderRadius.md,
                  marginBottom: theme.spacing.md,
                }}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        connectionStatus === 'online'
                          ? theme.colors.success
                          : connectionStatus === 'connecting'
                          ? theme.colors.warning
                          : theme.colors.error,
                      marginRight: theme.spacing.sm,
                    }}
                  />
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.md,
                      fontWeight: theme.typography.fontWeight.semibold,
                    }}>
                    Traffic Assist
                  </Text>
                </View>

                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.fontSize.sm,
                    textTransform: 'capitalize',
                  }}>
                  {connectionStatus}
                </Text>
              </View>

              {/* Quick Stats Row */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: theme.spacing.lg,
                }}>
                <View
                  style={{
                    backgroundColor: theme.colors.surfaceLight,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    flex: 1,
                    marginRight: theme.spacing.sm,
                  }}>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.typography.fontSize.sm,
                      textAlign: 'center',
                    }}>
                    Detections
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.xl,
                      fontWeight: theme.typography.fontWeight.bold,
                      textAlign: 'center',
                    }}>
                    {sessionData.detections}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: theme.colors.surfaceLight,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    flex: 1,
                    marginLeft: theme.spacing.sm,
                  }}>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.typography.fontSize.sm,
                      textAlign: 'center',
                    }}>
                    Accuracy
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.xl,
                      fontWeight: theme.typography.fontWeight.bold,
                      textAlign: 'center',
                    }}>
                    {Math.round(sessionData.accuracy * 100)}%
                  </Text>
                </View>
              </View>

              {/* Main Action Buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}>
                <Button
                  title="Dashboard"
                  onPress={() => setShowDashboard(true)}
                  variant="primary"
                  size="lg"
                  style={{flex: 1}}
                />

                <Button
                  title="Settings"
                  onPress={() => setShowSettings(true)}
                  variant="secondary"
                  size="lg"
                  style={{flex: 1}}
                />
              </View>
            </View>

            {/* Overlays */}
            <Dashboard
              isVisible={showDashboard}
              onClose={() => setShowDashboard(false)}
              connectionStatus={connectionStatus}
              sessionData={sessionData}
            />

            <Settings
              isVisible={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              onSettingChange={handleSettingChange}
            />
          </View>
        ) : (
          <SafeAreaView
            style={{flex: 1, backgroundColor: theme.colors.background}}>
            <StatusBar
              barStyle="light-content"
              backgroundColor={theme.colors.background}
            />
            <KeepAwake />

            {/* Camera Section - Top 2/3 */}
            <View style={{flex: 2, position: 'relative'}}>
              <CameraView />

              {/* Camera Overlay on top of camera */}
              <CameraOverlay
                detections={detections}
                connectionStatus={connectionStatus}
                metrics={{
                  fps: 30,
                  detectionCount: sessionData.detections,
                  accuracy: sessionData.accuracy,
                }}
              />
            </View>

            {/* Controls Section - Bottom 1/3 */}
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingTop: theme.spacing.lg,
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.xl,
              }}>
              {/* Connection Status Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: theme.colors.surfaceLight,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.borderRadius.md,
                  marginBottom: theme.spacing.md,
                }}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        connectionStatus === 'online'
                          ? theme.colors.success
                          : connectionStatus === 'connecting'
                          ? theme.colors.warning
                          : theme.colors.error,
                      marginRight: theme.spacing.sm,
                    }}
                  />
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.md,
                      fontWeight: theme.typography.fontWeight.semibold,
                    }}>
                    Traffic Assist
                  </Text>
                </View>

                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.fontSize.sm,
                    textTransform: 'capitalize',
                  }}>
                  {connectionStatus}
                </Text>
              </View>

              {/* Quick Stats Row */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: theme.spacing.lg,
                }}>
                <View
                  style={{
                    backgroundColor: theme.colors.surfaceLight,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    flex: 1,
                    marginRight: theme.spacing.sm,
                  }}>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.typography.fontSize.sm,
                      textAlign: 'center',
                    }}>
                    Detections
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.xl,
                      fontWeight: theme.typography.fontWeight.bold,
                      textAlign: 'center',
                    }}>
                    {sessionData.detections}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: theme.colors.surfaceLight,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    flex: 1,
                    marginLeft: theme.spacing.sm,
                  }}>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.typography.fontSize.sm,
                      textAlign: 'center',
                    }}>
                    Accuracy
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.xl,
                      fontWeight: theme.typography.fontWeight.bold,
                      textAlign: 'center',
                    }}>
                    {Math.round(sessionData.accuracy * 100)}%
                  </Text>
                </View>
              </View>

              {/* Main Action Buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}>
                <Button
                  title="Dashboard"
                  onPress={() => setShowDashboard(true)}
                  variant="primary"
                  size="lg"
                  style={{flex: 1}}
                />

                <Button
                  title="Settings"
                  onPress={() => setShowSettings(true)}
                  variant="secondary"
                  size="lg"
                  style={{flex: 1}}
                />
              </View>
            </View>

            {/* Overlays */}
            <Dashboard
              isVisible={showDashboard}
              onClose={() => setShowDashboard(false)}
              connectionStatus={connectionStatus}
              sessionData={sessionData}
            />

            <Settings
              isVisible={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              onSettingChange={handleSettingChange}
            />
          </SafeAreaView>
        )}
      </WebAdaptation>
    </ErrorBoundary>
  );
}
