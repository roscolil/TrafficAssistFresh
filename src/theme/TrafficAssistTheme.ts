// Professional Design System for Traffic Assist
export const TrafficAssistTheme = {
  // Color Palette inspired by automotive and traffic safety
  colors: {
    // Primary traffic colors
    trafficRed: '#E53E3E',
    trafficYellow: '#FFD700',
    trafficGreen: '#38A169',

    // Brand colors
    primary: '#2B6CB0', // Professional blue
    primaryDark: '#1A365D',
    primaryLight: '#BEE3F8',

    // Semantic colors
    success: '#38A169',
    warning: '#ED8936',
    error: '#E53E3E',
    info: '#3182CE',

    // Neutral palette
    background: '#0F1419', // Dark background for automotive feel
    surface: '#1A202C',
    surfaceLight: '#2D3748',
    overlay: 'rgba(26, 32, 44, 0.9)',

    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#A0AEC0',
    textMuted: '#718096',

    // UI elements
    border: '#4A5568',
    borderLight: '#718096',
    shadow: 'rgba(0, 0, 0, 0.3)',

    // Status indicators
    online: '#38A169',
    offline: '#E53E3E',
    connecting: '#ED8936',

    // Camera overlay
    cameraOverlay: 'rgba(0, 0, 0, 0.4)',
    detectionBox: '#00FF00',
    confidenceHigh: '#38A169',
    confidenceMedium: '#ED8936',
    confidenceLow: '#E53E3E',
  },

  // Typography
  typography: {
    // Font families
    fontFamily: {
      primary: 'System', // Use system font for best performance
      mono: 'Courier New',
    },

    // Font sizes
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 32,
      '4xl': 40,
    },

    // Font weights
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },

    // Line heights
    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },

  // Spacing system
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },

  // Border radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  },

  // Animation durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Layout dimensions
  layout: {
    headerHeight: 60,
    tabBarHeight: 80,
    buttonHeight: 48,
    buttonHeightLarge: 56,
    inputHeight: 44,
  },
};

// Platform-specific adjustments
export const PlatformTheme = {
  ios: {
    ...TrafficAssistTheme,
    shadows: {
      sm: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      md: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      lg: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
    },
  },
  android: {
    ...TrafficAssistTheme,
    // Android uses elevation instead of shadows
  },
  web: {
    ...TrafficAssistTheme,
    typography: {
      ...TrafficAssistTheme.typography,
      fontFamily: {
        primary:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
      },
    },
  },
};

export type Theme = typeof TrafficAssistTheme;
