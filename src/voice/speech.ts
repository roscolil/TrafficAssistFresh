// Safe imports with fallbacks
let Tts: any;
let Haptic: any;

try {
  Tts = require('react-native-tts');
} catch (error) {
  console.warn('react-native-tts not available:', error);
}

try {
  Haptic = require('react-native-haptic-feedback');
} catch (error) {
  console.warn('react-native-haptic-feedback not available:', error);
}

// Configure TTS for background audio (only if available)
if (Tts) {
  try {
    Tts.setDefaultLanguage('en-US');
    Tts.setDucking(true);
    Tts.setDefaultRate(0.46);

    // Set audio category for background playback
    try {
      Tts.setDefaultEngine('com.apple.ttsbundle.Samantha-compact');
    } catch (error) {
      // Fallback to default engine if Samantha is not available
      console.log('Using default TTS engine');
    }
  } catch (error) {
    console.warn('Error configuring TTS:', error);
  }
}

export function speakCue(cue: {
  text: string;
  priority: 'low' | 'medium' | 'high';
}) {
  // Haptic feedback (if available)
  if (Haptic) {
    try {
      Haptic.trigger(
        cue.priority === 'high'
          ? 'notificationError'
          : cue.priority === 'medium'
          ? 'notificationWarning'
          : 'notificationSuccess',
      );
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  // Text-to-speech (if available)
  if (Tts) {
    try {
      Tts.stop();
      Tts.speak(cue.text);
    } catch (error) {
      console.warn('TTS speak failed:', error);
    }
  } else {
    // Fallback: log the message when TTS is not available
    console.log('TTS not available. Would speak:', cue.text);
  }
}
