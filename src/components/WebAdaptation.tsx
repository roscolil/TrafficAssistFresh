// Web-specific adaptations for Traffic Assist
import React, {ReactNode, Component} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import {TrafficAssistTheme as theme} from '../theme/TrafficAssistTheme';
import {logError} from '../utils/logger';
import {getDeviceType, getScreenDimensions} from '../utils/responsive';

// Type declaration for cross-platform compatibility
declare const window: any;

interface WebAdaptationProps {
  children: React.ReactNode;
}

export const WebAdaptation: React.FC<WebAdaptationProps> = ({children}) => {
  const deviceType = getDeviceType();
  const {width, height} = getScreenDimensions();

  // For web platform, ensure full viewport usage
  if (Platform.OS === 'web') {
    if (deviceType === 'desktop') {
      return (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            backgroundColor: theme.colors.background,
            height: height,
            width: width,
            position: 'absolute',
            top: 0,
            left: 0,
          }}>
          {/* Left Sidebar for desktop */}
          <View
            style={{
              width: 250,
              backgroundColor: theme.colors.surface,
              borderRightWidth: 1,
              borderRightColor: theme.colors.border,
              padding: theme.spacing.lg,
            }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.xl,
                fontWeight: theme.typography.fontWeight.bold,
                marginBottom: theme.spacing.lg,
              }}>
              Traffic Assist
            </Text>

            {/* Desktop Quick Stats */}
            <View
              style={{
                backgroundColor: theme.colors.surfaceLight,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.lg,
                marginBottom: theme.spacing.md,
              }}>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.fontSize.sm,
                  marginBottom: theme.spacing.sm,
                }}>
                Status
              </Text>
              <Text
                style={{
                  color: theme.colors.success,
                  fontSize: theme.typography.fontSize.md,
                  fontWeight: theme.typography.fontWeight.semibold,
                }}>
                Active • Desktop Mode
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.colors.surfaceLight,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.lg,
                marginBottom: theme.spacing.md,
              }}>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.fontSize.sm,
                  marginBottom: theme.spacing.sm,
                }}>
                Display
              </Text>
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.fontSize.md,
                }}>
                {width} × {height}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.colors.surfaceLight,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.lg,
              }}>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.fontSize.sm,
                  marginBottom: theme.spacing.sm,
                }}>
                Layout
              </Text>
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.fontSize.md,
                }}>
                Camera: 2/3 • Controls: 1/3
              </Text>
            </View>
          </View>

          {/* Main content area with 2/3 camera layout */}
          <View
            style={{
              flex: 1,
              height: height,
            }}>
            {children}
          </View>
        </View>
      );
    } else {
      // Mobile/tablet web - ensure full viewport with new layout
      return (
        <View
          style={{
            flex: 1,
            height: height,
            width: width,
            backgroundColor: theme.colors.background,
            position: 'absolute',
            top: 0,
            left: 0,
          }}>
          {children}
        </View>
      );
    }
  }

  // Native mobile/tablet layout
  return <>{children}</>;
};

// Professional loading screen
export const LoadingScreen: React.FC<{message?: string}> = ({
  message = 'Initializing Traffic Assist...',
}) => (
  <View
    style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    }}>
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
        ...theme.shadows.lg,
      }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.trafficGreen,
        }}
      />
    </View>

    <Text
      style={{
        color: theme.colors.textPrimary,
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.semibold,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
      }}>
      Traffic Assist
    </Text>

    <Text
      style={{
        color: theme.colors.textSecondary,
        fontSize: theme.typography.fontSize.md,
        textAlign: 'center',
        lineHeight:
          theme.typography.lineHeight.relaxed * theme.typography.fontSize.md,
      }}>
      {message}
    </Text>

    {/* Animated loading indicator */}
    <View
      style={{
        marginTop: theme.spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      {[0, 1, 2].map(index => (
        <View
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.primary,
            marginHorizontal: 4,
            opacity: 0.6 + index * 0.2,
          }}
        />
      ))}
    </View>
  </View>
);

// Error boundary component
export const ErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({children, fallback}) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (error: any) => {
      logError('Traffic Assist Error', error, 'Components/WebAdaptation');
      setHasError(true);
    };

    // Only add window event listeners on web platform
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }
  }, []);

  if (hasError) {
    return (
      fallback || (
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.spacing.xl,
          }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: theme.colors.error,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: theme.spacing.xl,
            }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize['2xl'],
              }}>
              ⚠️
            </Text>
          </View>

          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.semibold,
              textAlign: 'center',
              marginBottom: theme.spacing.md,
            }}>
            Something went wrong
          </Text>

          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.md,
              textAlign: 'center',
              lineHeight:
                theme.typography.lineHeight.relaxed *
                theme.typography.fontSize.md,
            }}>
            Please refresh the page to try again
          </Text>
        </View>
      )
    );
  }

  return <>{children}</>;
};
