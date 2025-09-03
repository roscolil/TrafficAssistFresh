// Responsive utilities for cross-platform layouts
import {Dimensions, Platform} from 'react-native';

export const getScreenDimensions = () => {
  const {width, height} = Dimensions.get('window');
  return {width, height};
};

export const getDeviceType = () => {
  const {width} = getScreenDimensions();

  if (Platform.OS === 'web') {
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    if (width < 600) return 'phone';
    return 'tablet';
  }

  return 'unknown';
};

export const getResponsiveValue = <T>(values: {
  mobile: T;
  tablet?: T;
  desktop?: T;
  phone?: T;
}): T => {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'desktop':
      return values.desktop ?? values.tablet ?? values.mobile;
    case 'tablet':
      return values.tablet ?? values.mobile;
    case 'phone':
      return values.phone ?? values.mobile;
    case 'mobile':
    default:
      return values.mobile;
  }
};

export const isLandscape = () => {
  const {width, height} = getScreenDimensions();
  return width > height;
};

export const getResponsiveSpacing = (baseSpacing: number) => {
  return getResponsiveValue({
    mobile: baseSpacing,
    tablet: baseSpacing * 1.2,
    desktop: baseSpacing * 1.5,
  });
};

export const getResponsiveFontSize = (baseFontSize: number) => {
  return getResponsiveValue({
    mobile: baseFontSize,
    tablet: baseFontSize * 1.1,
    desktop: baseFontSize * 1.2,
  });
};
