import {useState, useEffect} from 'react';
import {Platform} from 'react-native';
import {logWarn, logDebug} from '../utils/logger';

// Type declarations for web compatibility
declare const navigator: any;

export interface LocationData {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

// Safe imports with error handling
let Geolocation: any = null;
let PermissionsAndroid: any = null;

try {
  if (Platform.OS === 'web') {
    // For web builds, rely on webpack alias to geolocation-mock.js
    // or use browser's native geolocation API directly
    Geolocation = {
      watchPosition: (success: any, error: any, options: any) => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          return navigator.geolocation.watchPosition(success, error, options);
        } else {
          error(new Error('Geolocation not supported'));
          return -1;
        }
      },
      clearWatch: (watchId: number) => {
        if (
          typeof navigator !== 'undefined' &&
          navigator.geolocation &&
          watchId !== -1
        ) {
          navigator.geolocation.clearWatch(watchId);
        }
      },
      requestAuthorization: () => Promise.resolve('granted'),
      getCurrentPosition: (success: any, error: any, options: any) => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(success, error, options);
        } else {
          error(new Error('Geolocation not supported'));
        }
      },
    };
    logDebug('Using browser geolocation API', undefined, 'Sensors/Location');
  } else {
    // Use react-native-geolocation-service for mobile platforms
    Geolocation = require('react-native-geolocation-service');

    // Import PermissionsAndroid for Android
    if (Platform.OS === 'android') {
      const RN = require('react-native');
      PermissionsAndroid = RN.PermissionsAndroid;
    }

    logDebug(
      'Using react-native-geolocation-service',
      undefined,
      'Sensors/Location',
    );
  }
} catch (error) {
  logWarn(
    'Geolocation module not available - using fallback',
    error,
    'Sensors/Location',
  );
  // Fallback implementation
  Geolocation = {
    watchPosition: () => -1,
    clearWatch: () => {},
    requestAuthorization: () => Promise.resolve('denied'),
    getCurrentPosition: () => {},
  };
}

let Heading: any = null;
try {
  Heading = require('react-native-heading');
} catch (error) {
  logWarn('Heading module not available', error, 'Sensors/Location');
}

// Request location permissions
async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true; // Browser will handle permission request
  }

  try {
    if (Platform.OS === 'ios') {
      // For iOS, first check current authorization status
      let authStatus;
      try {
        // Check if we already have permission
        authStatus = await Geolocation.requestAuthorization('whenInUse');
        logDebug(
          'iOS location authorization status',
          authStatus,
          'Sensors/Location',
        );

        if (authStatus === 'granted') {
          return true;
        } else if (authStatus === 'denied') {
          logWarn(
            'Location permission was denied by user',
            undefined,
            'Sensors/Location',
          );
          return false;
        } else if (authStatus === 'disabled') {
          logWarn(
            'Location services are disabled on device',
            undefined,
            'Sensors/Location',
          );
          return false;
        } else {
          logWarn(
            'Location permission not determined or restricted',
            authStatus,
            'Sensors/Location',
          );
          return false;
        }
      } catch (error) {
        logWarn(
          'Error requesting iOS location permission',
          error,
          'Sensors/Location',
        );
        return false;
      }
    } else if (Platform.OS === 'android' && PermissionsAndroid) {
      // For Android, request fine location permission
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message:
            'This app needs access to your location for traffic assistance.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      logDebug(
        'Android location permission granted',
        hasPermission,
        'Sensors/Location',
      );
      return hasPermission;
    }

    return true; // Default to true for other platforms
  } catch (error) {
    logWarn('Error requesting location permission', error, 'Sensors/Location');
    return false;
  }
}

export function useLocation() {
  const [location, setLocation] = useState<
    {lat: number; lon: number; speed?: number} | undefined
  >(undefined);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  useEffect(() => {
    if (!Geolocation) {
      logWarn(
        'Geolocation service not available',
        undefined,
        'Sensors/Location',
      );
      return;
    }

    // Request permission first
    requestLocationPermission()
      .then(granted => {
        setPermissionGranted(granted);
        if (!granted) {
          logWarn(
            'Location permission denied, using mock location for testing',
            undefined,
            'Sensors/Location',
          );

          // Set a mock location for testing when permission is denied
          setLocation({
            lat: 37.7749, // San Francisco coordinates
            lon: -122.4194,
            speed: 0,
          });
          return;
        }

        try {
          const watchId = Geolocation.watchPosition(
            (position: any) => {
              setLocation({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                speed: position.coords.speed,
              });
              logDebug(
                'Location updated',
                {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                },
                'Sensors/Location',
              );
            },
            (err: any) => {
              logWarn('Geolocation error', err, 'Sensors/Location');
              // Try to provide helpful error message
              if (err.code === 1) {
                logWarn(
                  'Location permission denied by user',
                  err,
                  'Sensors/Location',
                );
                // Fallback to mock location
                setLocation({
                  lat: 37.7749,
                  lon: -122.4194,
                  speed: 0,
                });
              } else if (err.code === 2) {
                logWarn(
                  'Location position unavailable',
                  err,
                  'Sensors/Location',
                );
              } else if (err.code === 3) {
                logWarn('Location request timeout', err, 'Sensors/Location');
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 10000,
              distanceFilter: 10, // Only update if moved 10 meters
            },
          );

          return () => {
            try {
              Geolocation.clearWatch(watchId);
            } catch (error) {
              logWarn(
                'Error clearing geolocation watch',
                error,
                'Sensors/Location',
              );
            }
          };
        } catch (error) {
          logWarn('Error setting up geolocation', error, 'Sensors/Location');
        }
      })
      .catch(error => {
        logWarn(
          'Error requesting location permission',
          error,
          'Sensors/Location',
        );
        // Set mock location as fallback
        setLocation({
          lat: 37.7749,
          lon: -122.4194,
          speed: 0,
        });
      });
  }, []);

  return {location, permissionGranted};
}

export function useHeading() {
  const [heading, setHeading] = useState<number>(0);

  useEffect(() => {
    if (!Heading) {
      logWarn('Heading service not available', undefined, 'Sensors/Location');
      return;
    }

    try {
      Heading.start(1)
        .then(() => {
          Heading.on((deg: number) => setHeading(deg));
          logDebug('Heading service started', undefined, 'Sensors/Location');
        })
        .catch((error: any) => {
          logWarn('Error starting heading service', error, 'Sensors/Location');
        });

      return () => {
        try {
          Heading.stop();
        } catch (error) {
          logWarn('Error stopping heading service', error, 'Sensors/Location');
        }
      };
    } catch (error) {
      logWarn('Error setting up heading service', error, 'Sensors/Location');
    }
  }, []);

  return {heading};
}

// Helper function to get current location as a promise
export async function getCurrentLocation(): Promise<LocationData> {
  if (!Geolocation) {
    throw new Error('Geolocation service not available');
  }

  // Request permission first
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    logWarn(
      'Location permission denied, using mock location',
      undefined,
      'Sensors/Location',
    );
    // Return mock location for testing
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      heading: 0,
      speed: 0,
      accuracy: 100,
    };
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position: any) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
        });
      },
      (error: any) => {
        logWarn('getCurrentPosition error', error, 'Sensors/Location');

        // Provide helpful error messages and fallback to mock location
        let errorMessage = 'Failed to get location';
        if (error.code === 1) {
          errorMessage = 'Location permission denied';
          // Return mock location instead of rejecting
          resolve({
            latitude: 37.7749,
            longitude: -122.4194,
            heading: 0,
            speed: 0,
            accuracy: 100,
          });
          return;
        } else if (error.code === 2) {
          errorMessage = 'Location position unavailable';
        } else if (error.code === 3) {
          errorMessage = 'Location request timeout';
        }

        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );
  });
}
