import React, {useEffect} from 'react';
import {View, Platform, Text} from 'react-native';

// Test flags to isolate issues - gradually enable
const ENABLE_SENSORS = true;
const ENABLE_VISION_CAMERA = true; // Try enabling again with better error handling
const ENABLE_CAMERA_DEVICES = true; // Don't use camera devices yet
const ENABLE_REANIMATED = true;
const ENABLE_AI_POLICY = true;

// Safe sensor imports
let useHeading: any = () => ({heading: 0});
let useLocation: any = () => ({location: null});

if (ENABLE_SENSORS) {
  try {
    const sensors = require('../sensors/location');
    useHeading = sensors.useHeading;
    useLocation = sensors.useLocation;
  } catch (error) {
    console.warn('Sensor modules not available:', error);
  }
}

// Safe imports with fallbacks
let Camera: any;
let useCameraDevices: any;
let useFrameProcessor: any;
let runOnJS: any;

if (ENABLE_VISION_CAMERA) {
  try {
    console.log('Attempting to load react-native-vision-camera...');
    const visionCamera = require('react-native-vision-camera');
    console.log('Vision camera module loaded successfully');

    Camera = visionCamera.Camera;

    if (ENABLE_CAMERA_DEVICES) {
      useCameraDevices = visionCamera.useCameraDevices;
      useFrameProcessor = visionCamera.useFrameProcessor;
    }

    console.log('Vision camera components extracted successfully');
  } catch (error) {
    console.error('Failed to load react-native-vision-camera:', error);
    Camera = null;
  }
}

if (ENABLE_REANIMATED) {
  try {
    const reanimated = require('react-native-reanimated');
    runOnJS = reanimated.runOnJS;
  } catch (error) {
    console.warn('react-native-reanimated not available:', error);
  }
}

// Safe imports for other modules
let runDetector: any;
let speakCue: any;
let useEarlyWarning: any;

if (ENABLE_AI_POLICY) {
  try {
    runDetector = require('../ai/infer').runDetector;
  } catch (error) {
    console.warn('AI inference module not available:', error);
  }

  try {
    speakCue = require('../voice/speech').speakCue;
  } catch (error) {
    console.warn('Speech module not available:', error);
  }

  try {
    useEarlyWarning = require('../logic/policy').useEarlyWarning;
  } catch (error) {
    console.warn('Policy module not available:', error);
  }
}

export default function CameraView() {
  const {heading} = useHeading();
  const {location} = useLocation();

  // Safe camera devices hook - only if enabled
  const devices =
    useCameraDevices && ENABLE_CAMERA_DEVICES ? useCameraDevices() : null;
  const device = devices?.back;

  // Safe policy hook
  const policy = useEarlyWarning ? useEarlyWarning() : null;

  useEffect(() => {
    if (!Camera) {
      console.warn('Camera not available - skipping permission request');
      return;
    }

    console.log('Requesting camera permission...');
    (async () => {
      try {
        const cam = await Camera.requestCameraPermission();
        console.log('Camera permission result:', cam);
        if (cam !== 'granted') console.warn('Camera permission not granted');
      } catch (error) {
        console.error('Error requesting camera permission:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!policy) return;

    try {
      const sub = policy.onCue((cue: any) => {
        if (speakCue) {
          speakCue(cue);
        }
      });
      return () => sub.remove();
    } catch (error) {
      console.warn('Error setting up policy subscription:', error);
    }
  }, [policy]);

  const frameProcessor =
    useFrameProcessor && ENABLE_REANIMATED
      ? useFrameProcessor(
          (frame: any) => {
            'worklet';
            if (runOnJS && runDetector && policy) {
              runOnJS(runDetector)({
                frameWidth: frame.width,
                frameHeight: frame.height,
              })
                .then((result: any) => {
                  runOnJS(policy.ingest)({
                    detections: result.objects,
                    heading,
                    location,
                    ts: result.timestamp,
                  });
                })
                .catch(() => {});
            }
          },
          [heading, location],
        )
      : null;

  // If camera is not available, show a fallback view
  if (!Camera || (!device && ENABLE_CAMERA_DEVICES)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{color: 'white', textAlign: 'center', padding: 20}}>
          Camera Status:{'\n'}
          Vision Camera Module: {Camera ? '✅' : '❌'}
          {'\n'}
          Camera Devices:{' '}
          {ENABLE_CAMERA_DEVICES ? (device ? '✅' : '❌') : '❌ (Disabled)'}
          {'\n'}
          Sensors: {ENABLE_SENSORS ? '✅' : '❌ (Disabled)'}
          {'\n'}
          Frame Processor: {ENABLE_REANIMATED ? '✅' : '❌ (Disabled)'}
          {'\n\n'}
          {!Camera && 'Camera module failed to load'}
          {Camera &&
            !device &&
            ENABLE_CAMERA_DEVICES &&
            `No camera device found\n${
              Platform.OS === 'ios'
                ? '📱 iOS Simulator has no camera\nTest on a real device for camera functionality'
                : 'No camera available'
            }`}
        </Text>
      </View>
    );
  }

  // If we have Camera module but devices are disabled, show a simple test view
  if (Camera && !ENABLE_CAMERA_DEVICES) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{color: 'white', textAlign: 'center', padding: 20}}>
          Camera Module Loaded Successfully! ✅{'\n\n'}
          Camera devices disabled for testing.{'\n'}
          Set ENABLE_CAMERA_DEVICES = true to continue.
        </Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1}}>
      <Camera
        style={{flex: 1}}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        frameProcessorFps={15}
        pixelFormat={Platform.OS === 'ios' ? 'yuv' : 'nv21'}
        photo={false}
        video={false}
        audio={false}
        enableZoomGesture={false}
      />
    </View>
  );
}
