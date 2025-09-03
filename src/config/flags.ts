// Check if we're in development mode (works for both React Native and web)
const isDevelopment =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');

export const flags = {
  cloudConfirmEnabled: true,
  confirmApiUrl: 'https://cloud-confirm-190217655466.europe-west1.run.app',

  maxCloudCropsPerMinute: 2,
  lowConfBand: [0.45, 0.6] as [number, number],
  intersectionPackUrl: undefined as string | undefined,

  // Backend Integration
  backendIntegrationEnabled: true,
  backendTrafficFetchEnabled: false, // Disable until backend API is ready
  backendDeviceRegistrationEnabled: false, // Disable until backend API is ready
  backendWebSocketEnabled: false, // Disable until backend WebSocket is ready
  backendApiUrl: isDevelopment
    ? 'http://localhost:3000'
    : 'https://traffic-assist-api-axoirfzmzq-uc.a.run.app',
  backendWebSocketUrl: isDevelopment
    ? 'ws://localhost:3000'
    : 'wss://traffic-assist-api-axoirfzmzq-uc.a.run.app',
};
