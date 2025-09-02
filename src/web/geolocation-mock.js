// Web geolocation mock using browser APIs
const Geolocation = {
  watchPosition: (success, error, options) => {
    if (!navigator.geolocation) {
      error && error({ code: 1, message: 'Geolocation not supported' });
      return null;
    }

    return navigator.geolocation.watchPosition(success, error, options);
  },

  clearWatch: (watchId) => {
    if (navigator.geolocation && watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
  },
};

export default Geolocation;
