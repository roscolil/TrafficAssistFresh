import {useEffect, useState} from 'react';

// Safe imports with fallbacks
let Geolocation: any;
let Heading: any;

try {
  Geolocation = require('react-native-geolocation-service');
} catch (error) {
  console.warn('react-native-geolocation-service not available:', error);
}

try {
  Heading = require('react-native-heading');
} catch (error) {
  console.warn('react-native-heading not available:', error);
}

export function useLocation() {
  const [location, setLoc] = useState<
    {lat: number; lon: number; speed?: number} | undefined
  >(undefined);

  useEffect(() => {
    if (!Geolocation) {
      console.warn('Geolocation service not available');
      return;
    }

    try {
      const watchId = Geolocation.watchPosition(
        (pos: any) =>
          setLoc({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            speed: pos.coords.speed ?? 0,
          }),
        (err: any) => console.warn('geo error', err),
        {
          enableHighAccuracy: true,
          distanceFilter: 3,
          interval: 500,
          fastestInterval: 250,
        },
      );
      return () => {
        try {
          Geolocation.clearWatch(watchId);
        } catch (error) {
          console.warn('Error clearing geolocation watch:', error);
        }
      };
    } catch (error) {
      console.warn('Error setting up geolocation:', error);
    }
  }, []);

  return {location};
}

export function useHeading() {
  const [heading, setHeading] = useState<number>(0);

  useEffect(() => {
    if (!Heading) {
      console.warn('Heading service not available');
      return;
    }

    try {
      Heading.start(1)
        .then(() => {
          Heading.on((deg: number) => setHeading(deg));
        })
        .catch((error: any) => {
          console.warn('Error starting heading service:', error);
        });

      return () => {
        try {
          Heading.stop();
        } catch (error) {
          console.warn('Error stopping heading service:', error);
        }
      };
    } catch (error) {
      console.warn('Error setting up heading service:', error);
    }
  }, []);

  return {heading};
}
