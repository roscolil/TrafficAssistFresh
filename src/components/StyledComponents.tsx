import * as React from 'react';
import {View, Text, TouchableOpacity, ViewStyle, TextStyle} from 'react-native';
import {TrafficAssistTheme as theme} from '../theme/TrafficAssistTheme';

// Professional Button Component
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  fullWidth = false,
  style,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.md,
    };

    // Size variants
    const sizeStyles = {
      sm: {height: 40, paddingHorizontal: theme.spacing.md},
      md: {height: theme.layout.buttonHeight},
      lg: {height: theme.layout.buttonHeightLarge},
    };

    // Color variants
    const colorStyles = {
      primary: {
        backgroundColor: theme.colors.primary,
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      danger: {
        backgroundColor: theme.colors.error,
        borderWidth: 0,
      },
      success: {
        backgroundColor: theme.colors.success,
        borderWidth: 0,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...colorStyles[variant],
      ...(fullWidth && {width: '100%'}),
      ...(disabled && {
        opacity: 0.6,
        backgroundColor: theme.colors.surfaceLight,
      }),
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: theme.typography.fontWeight.semibold,
      textAlign: 'center',
    };

    const sizeStyles = {
      sm: {fontSize: theme.typography.fontSize.sm},
      md: {fontSize: theme.typography.fontSize.md},
      lg: {fontSize: theme.typography.fontSize.lg},
    };

    const colorStyles = {
      primary: {color: theme.colors.textPrimary},
      secondary: {color: theme.colors.textPrimary},
      danger: {color: theme.colors.textPrimary},
      success: {color: theme.colors.textPrimary},
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...colorStyles[variant],
      ...(disabled && {color: theme.colors.textMuted}),
    };
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}>
      {icon && <View style={{marginRight: theme.spacing.sm}}>{icon}</View>}
      <Text style={getTextStyle()}>{title}</Text>
    </TouchableOpacity>
  );
};

// Professional Card Component
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: keyof typeof theme.spacing;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'lg',
  style,
}) => {
  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[padding],
    };

    const variantStyles = {
      default: {},
      elevated: {
        ...theme.shadows.lg,
      },
      outlined: {
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
      ...style,
    };
  };

  return <View style={getCardStyle()}>{children}</View>;
};

// Status Indicator Component
interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const getIndicatorStyle = () => {
    const sizes = {
      sm: 8,
      md: 12,
      lg: 16,
    };

    const colors = {
      online: theme.colors.online,
      offline: theme.colors.offline,
      connecting: theme.colors.connecting,
    };

    return {
      width: sizes[size],
      height: sizes[size],
      borderRadius: sizes[size] / 2,
      backgroundColor: colors[status],
      marginRight: label ? theme.spacing.sm : 0,
    };
  };

  return (
    <View style={{flexDirection: 'row', alignItems: 'center'}}>
      <View style={getIndicatorStyle()} />
      {label && (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
          }}>
          {label}
        </Text>
      )}
    </View>
  );
};

// Traffic Light Component
interface TrafficLightProps {
  state: 'red' | 'yellow' | 'green' | 'unknown';
  size?: number;
  confidence?: number;
}

export const TrafficLight: React.FC<TrafficLightProps> = ({
  state,
  size = 40,
  confidence,
}) => {
  const getBackgroundColor = () => {
    switch (state) {
      case 'red':
        return theme.colors.trafficRed;
      case 'yellow':
        return theme.colors.trafficYellow;
      case 'green':
        return theme.colors.trafficGreen;
      default:
        return theme.colors.surfaceLight;
    }
  };

  const getConfidenceColor = () => {
    if (!confidence) return 'transparent';
    if (confidence > 0.8) return theme.colors.confidenceHigh;
    if (confidence > 0.5) return theme.colors.confidenceMedium;
    return theme.colors.confidenceLow;
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getBackgroundColor(),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: getConfidenceColor(),
        ...theme.shadows.md,
      }}>
      {state === 'unknown' && (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: size * 0.3,
            fontWeight: theme.typography.fontWeight.bold,
          }}>
          ?
        </Text>
      )}
    </View>
  );
};

// Professional Header Component
interface HeaderProps {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
  leftComponent?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightComponent,
  leftComponent,
  style,
}) => {
  return (
    <View
      style={[
        {
          height: theme.layout.headerHeight,
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          ...theme.shadows.sm,
        },
        style,
      ]}>
      {leftComponent}

      <View style={{flex: 1, marginHorizontal: theme.spacing.md}}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            textAlign: leftComponent ? 'left' : 'center',
          }}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              textAlign: leftComponent ? 'left' : 'center',
            }}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightComponent}
    </View>
  );
};

// Metrics Display Component
interface MetricDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export const MetricDisplay: React.FC<MetricDisplayProps> = ({
  label,
  value,
  unit,
  trend,
  color = theme.colors.textPrimary,
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return theme.colors.success;
      case 'down':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <View
      style={{
        alignItems: 'center',
        padding: theme.spacing.md,
      }}>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          marginBottom: theme.spacing.xs,
        }}>
        {label}
      </Text>

      <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
        <Text
          style={{
            color: color,
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
          }}>
          {value}
        </Text>
        {unit && (
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              marginLeft: theme.spacing.xs,
            }}>
            {unit}
          </Text>
        )}
      </View>

      {trend && (
        <Text
          style={{
            color: getTrendColor(),
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            marginTop: theme.spacing.xs,
          }}>
          {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
        </Text>
      )}
    </View>
  );
};
