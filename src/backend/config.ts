// Backend configuration for cross-platform compatibility
import {Platform} from 'react-native';

// Type declarations for cross-platform compatibility
declare const window: any;
declare const navigator: any;

export interface BackendConfig {
  apiUrl: string;
  wsUrl: string;
  environment: 'web' | 'ios' | 'android';
}

// Default configuration - Production
const productionConfig: BackendConfig = {
  apiUrl: 'https://traffic-assist-api-axoirfzmzq-uc.a.run.app',
  wsUrl: 'wss://traffic-assist-api-axoirfzmzq-uc.a.run.app',
  environment: 'web',
};

// Development configuration
const developmentConfig: BackendConfig = {
  apiUrl: 'https://traffic-assist-api-dev-axoirfzmzq-uc.a.run.app',
  wsUrl: 'wss://traffic-assist-api-dev-axoirfzmzq-uc.a.run.app',
  environment: 'web',
};

// Local development configuration
const localConfig: BackendConfig = {
  apiUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3001',
  environment: 'web',
};

// Environment detection
export const getEnvironmentMode = ():
  | 'local'
  | 'development'
  | 'production' => {
  // Check if running locally (only on web platform)
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname === 'localhost'
  ) {
    return 'local';
  }

  // Check environment variables
  const nodeEnv = getEnvVar('NODE_ENV', '');
  const reactEnv = getEnvVar('REACT_APP_ENVIRONMENT', '');

  if (nodeEnv === 'development' || reactEnv === 'development') {
    return 'development';
  }

  return 'production';
};

// Get default config based on environment
const getDefaultConfig = (): BackendConfig => {
  const mode = getEnvironmentMode();

  switch (mode) {
    case 'local':
      return localConfig;
    case 'development':
      return developmentConfig;
    case 'production':
    default:
      return productionConfig;
  }
};

// Environment detection helper
export const detectEnvironment = (): 'web' | 'ios' | 'android' => {
  // React Native environment
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    // Additional check for platform
    const Platform = require('react-native').Platform;
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }

  // Web environment
  return 'web';
};

// Environment variable helper for browser compatibility
const getEnvVar = (key: string, defaultValue: string): string => {
  // In React Native, we can access process.env
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }

  // In web browsers, check for webpack DefinePlugin injected variables
  if (typeof window !== 'undefined') {
    try {
      // Check if environment variables were injected by webpack
      const globalConfig = (window as any).__TRAFFIC_ASSIST_CONFIG__;
      if (globalConfig && globalConfig[key]) {
        return globalConfig[key];
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return defaultValue;
};

// Get backend configuration based on environment
export const getBackendConfig = (): BackendConfig => {
  const environment = detectEnvironment();
  const defaultConfig = getDefaultConfig();

  // Get configuration from environment variables or use defaults
  const config: BackendConfig = {
    apiUrl: getEnvVar('REACT_APP_API_URL', defaultConfig.apiUrl),
    wsUrl: getEnvVar('REACT_APP_WS_URL', defaultConfig.wsUrl),
    environment,
  };

  // Platform-specific adjustments for local development
  if (environment === 'web' && Platform.OS === 'web') {
    // For web, use current host if running locally
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.hostname === 'localhost' &&
      config.apiUrl === defaultConfig.apiUrl
    ) {
      const protocol =
        window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host =
        window.location.hostname === 'localhost'
          ? 'localhost:3001'
          : window.location.host;
      config.apiUrl = `${protocol}//${host}`;
    }

    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.hostname === 'localhost' &&
      config.wsUrl === defaultConfig.wsUrl
    ) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host =
        window.location.hostname === 'localhost'
          ? 'localhost:3001'
          : window.location.host;
      config.wsUrl = `${protocol}//${host}`;
    }
  }

  return config;
};

// Production configuration
export const setProductionConfig = (apiUrl: string) => {
  if (typeof window !== 'undefined') {
    (window as any).__TRAFFIC_ASSIST_CONFIG__ = {
      REACT_APP_API_URL: apiUrl,
      REACT_APP_WS_URL: apiUrl.replace('http', 'ws').replace('https', 'wss'),
    };
  }
};
