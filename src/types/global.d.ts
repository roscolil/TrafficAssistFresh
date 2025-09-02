// Global type declarations for cross-platform compatibility
declare global {
  interface Window {
    __TRAFFIC_ASSIST_CONFIG__?: {
      REACT_APP_API_URL?: string;
      REACT_APP_WS_URL?: string;
    };
  }

  namespace NodeJS {
    interface ProcessEnv {
      REACT_APP_API_URL?: string;
      REACT_APP_WS_URL?: string;
      NODE_ENV?: string;
    }
  }
}

// React Native Platform detection
declare const navigator:
  | {
      product?: string;
      userAgent?: string;
    }
  | undefined;

export {};
