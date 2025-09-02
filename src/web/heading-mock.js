// Web heading mock using device orientation
const Heading = {
  start: (updateRate = 1) => {
    return new Promise((resolve) => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(response => {
            if (response === 'granted') {
              resolve();
            } else {
              console.warn('Device orientation permission denied');
              resolve();
            }
          })
          .catch(console.error);
      } else {
        resolve();
      }
    });
  },

  on: (callback) => {
    const handleOrientation = (event) => {
      // Convert device orientation to compass heading
      const heading = event.alpha || 0;
      callback(heading);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  },

  stop: () => {
    // Cleanup handled by removing event listeners
  },
};

export default Heading;
