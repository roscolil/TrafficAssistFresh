// Web TTS mock using Speech Synthesis API
const Tts = {
  setDefaultLanguage: (language) => {
    console.log('TTS language set to:', language);
  },

  setDucking: (enabled) => {
    console.log('TTS ducking:', enabled);
  },

  setDefaultRate: (rate) => {
    Tts._rate = rate;
  },

  setDefaultEngine: (engine) => {
    console.log('TTS engine:', engine);
  },

  speak: (text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Tts._rate || 0.46;
      utterance.lang = 'en-US';

      window.speechSynthesis.speak(utterance);
    } else {
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
