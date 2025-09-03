import {logWarn, logInfo, logDebug} from '../utils/logger';

// Safe imports with error handling
let TTS: any = null;
try {
  TTS = require('react-native-tts');
} catch (error) {
  logWarn('TTS module not available', error, 'Voice/Speech');
}

let HapticFeedback: any = null;
try {
  HapticFeedback = require('react-native-haptic-feedback');
} catch (error) {
  logWarn('Haptic feedback module not available', error, 'Voice/Speech');
}

export function initSpeech() {
  if (TTS) {
    try {
      TTS.setDefaultLanguage('en-US');
      TTS.setDucking(true);
      TTS.setDefaultRate(0.46);

      // Try iOS default voice
      try {
        TTS.setDefaultEngine('com.apple.ttsbundle.Samantha-compact');
        logInfo('TTS configured with iOS voice', undefined, 'Voice/Speech');
      } catch {
        logInfo('Using default TTS engine', undefined, 'Voice/Speech');
      }
    } catch (error) {
      logWarn('Error configuring TTS', error, 'Voice/Speech');
    }
  }
}

export async function speakCue(cue: {text: string; urgency?: number}) {
  if (cue.urgency && HapticFeedback) {
    try {
      // Haptic feedback based on urgency
      HapticFeedback.trigger(
        cue.urgency > 7 ? 'notificationError' : 'notificationWarning',
        {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        },
      );
    } catch (error) {
      logWarn('Haptic feedback failed', error, 'Voice/Speech');
    }
  }

  if (TTS) {
    try {
      TTS.stop();
      TTS.speak(cue.text);
      logDebug('TTS spoke message', {text: cue.text}, 'Voice/Speech');
    } catch (error) {
      logWarn('TTS speak failed', error, 'Voice/Speech');
    }
  } else {
    logInfo('TTS not available. Would speak', {text: cue.text}, 'Voice/Speech');
  }
}
