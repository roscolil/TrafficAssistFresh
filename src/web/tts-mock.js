// Web TTS mock using Speech Synthesis API
const Tts = {
  setDefaultLanguage: (language) => {
    // Web browsers use Speech Synthesis API
  },

  setDucking: (enabled) => {
    // Web browsers handle audio ducking differently
  },

  setDefaultRate: (rate) => {
    Tts._rate = rate;
  },

  setDefaultEngine: (engine) => {
    // Web browsers have different voice engines
  },

  speak: (text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Tts._rate || 0.46;
      utterance.lang = 'en-US';

      window.speechSynthesis.speak(utterance);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('TTS not available. Would speak:', text);
    }
  },

  stop: () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  _rate: 0.46,
};

export default Tts;
