import React, {useEffect, useState} from 'react';
import {View, Platform, Text} from 'react-native';
import {logWarn, logInfo, logDebug, logError} from '../utils/logger';
import DetectionOverlay from '../components/DetectionOverlay';
import DemoMode from '../components/DemoMode';

// Test flags to isolate issues - gradually enable
const ENABLE_SENSORS = true;
const ENABLE_VISION_CAMERA = true; // Try enabling again with better error handling
const ENABLE_CAMERA_DEVICES = false; // Disable for simulator demo mode
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
    logWarn('Sensor modules not available', error, 'CameraView');
  }
}

// Safe imports with fallbacks
let Camera: any;
let useCameraDevices: any;
let useFrameProcessor: any;
let runOnJS: any;

if (ENABLE_VISION_CAMERA) {
  try {
    logDebug(
      'Attempting to load react-native-vision-camera',
      undefined,
      'CameraView',
    );
    const visionCamera = require('react-native-vision-camera');
    logInfo(
      'Vision camera module loaded successfully',
      undefined,
      'CameraView',
    );

    Camera = visionCamera.Camera;

    if (ENABLE_CAMERA_DEVICES) {
      useCameraDevices = visionCamera.useCameraDevices;
      useFrameProcessor = visionCamera.useFrameProcessor;
    }

    logDebug(
      'Vision camera components extracted successfully',
      undefined,
      'CameraView',
    );
  } catch (error) {
    logError('Failed to load react-native-vision-camera', error, 'CameraView');
    Camera = null;
  }
}

if (ENABLE_REANIMATED) {
  try {
    const reanimated = require('react-native-reanimated');
    runOnJS = reanimated.runOnJS;
  } catch (error) {
    logWarn('react-native-reanimated not available', error, 'CameraView');
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
    logWarn('AI inference module not available', error, 'CameraView');
  }

  try {
    speakCue = require('../voice/speech').speakCue;
  } catch (error) {
    logWarn('Speech module not available', error, 'CameraView');
  }

  try {
    useEarlyWarning = require('../logic/policy').useEarlyWarning;
  } catch (error) {
    logWarn('Policy module not available', error, 'CameraView');
  }
}

export default function CameraView() {
  const [currentDetections, setCurrentDetections] = useState<any[]>([]);
  const [lastCue, setLastCue] = useState<string>('');
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(
    null,
  );

  const {heading} = useHeading();
  const {location, permissionGranted} = useLocation();

  // Safe camera devices hook - only if enabled
  const devices =
    useCameraDevices && ENABLE_CAMERA_DEVICES ? useCameraDevices() : null;
  const device = devices?.back;

  // Safe policy hook
  const policy = useEarlyWarning ? useEarlyWarning() : null;

  useEffect(() => {
    if (!Camera) {
      logWarn(
        'Camera not available - skipping permission request',
        undefined,
        'CameraView',
      );
      return;
    }

    logDebug('Requesting camera permission', undefined, 'CameraView');
    (async () => {
      try {
        const cam = await Camera.requestCameraPermission();
        logInfo('Camera permission result', {permission: cam}, 'CameraView');
        if (cam !== 'granted')
          logWarn(
            'Camera permission not granted',
            {permission: cam},
            'CameraView',
          );
      } catch (error) {
        logError('Error requesting camera permission', error, 'CameraView');
      }
    })();
  }, []);

  useEffect(() => {
    if (!policy) return;

    try {
      const sub = policy.onCue((cue: any) => {
        setLastCue(cue.text);
        if (speakCue) {
          speakCue(cue);
        }
      });
      return () => sub.remove();
    } catch (error) {
      logWarn('Error setting up policy subscription', error, 'CameraView');
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
                  runOnJS(setCurrentDetections)(result.objects || []);

                  // Calculate distance for the best detection
                  const trafficLights = (result.objects || []).filter(
                    (d: any) => d.cls === 'traffic_light',
                  );
                  if (trafficLights.length > 0) {
                    const best = trafficLights.sort(
                      (a: any, b: any) => b.conf - a.conf,
                    )[0];
                    const estimateDistanceMeters =
                      require('../ai/utils').estimateDistanceMeters;
                    const dist = estimateDistanceMeters(best.bbox);
                    runOnJS(setEstimatedDistance)(dist);
                  }

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

  // If we have Camera module but devices are disabled, show a demo mode
  if (Camera && !ENABLE_CAMERA_DEVICES) {
    return (
      <DemoMode
        detections={currentDetections}
        distance={estimatedDistance}
        lastCue={lastCue}
        onDetectionsUpdate={setCurrentDetections}
        onDistanceUpdate={setEstimatedDistance}
        policy={policy}
        heading={heading}
        location={location}
      />
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
      <DetectionOverlay
        detections={currentDetections}
        distance={estimatedDistance}
        lastCue={lastCue}
      />
    </View>
  );
}
