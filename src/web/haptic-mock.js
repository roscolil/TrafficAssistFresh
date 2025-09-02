// Web haptic feedback mock using Vibration API
const Haptic = {
  trigger: (type) => {
    if ('vibrate' in navigator) {
      let pattern;
      switch (type) {
        case 'notificationError':
          pattern = [100, 50, 100, 50, 100]; // Strong vibration
          break;
        case 'notificationWarning':
          pattern = [100, 50, 100]; // Medium vibration
          break;
        case 'notificationSuccess':
          pattern = [100]; // Light vibration
          break;
        default:
          pattern = [50];
      }
      navigator.vibrate(pattern);
    } else {
      console.log('Haptic feedback not available. Type:', type);
    }
  },
};

export default Haptic;
