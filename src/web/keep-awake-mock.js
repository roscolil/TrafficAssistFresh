// Web KeepAwake mock - prevents screen from sleeping using Wake Lock API
import React from 'react';

let wakeLock = null;

const KeepAwake = () => {
  React.useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Screen wake lock activated');
        } else {
          console.log('Wake Lock API not supported');
        }
      } catch (error) {
        console.warn('Failed to activate wake lock:', error);
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Screen wake lock released');
      }
    };
  }, []);

  return null; // This component doesn't render anything
};

export default KeepAwake;
export { KeepAwake };
