import {postprocessYOLO, mockDetectionsOnce} from './utils';
import {logWarn, logDebug} from '../utils/logger';

// Safe imports with error handling
let TensorFlowLite: any = null;
let createModel: any = null;

try {
  TensorFlowLite = require('react-native-fast-tflite');
  createModel = TensorFlowLite?.createModel;
} catch (error) {
  logWarn(
    'TensorFlow Lite module not available - using mock detections',
    error,
    'AI/Inference',
  );
}

let model: any | null = null;
let tried = false;

// Webpack-defined constant for web builds
declare const __IS_WEB__: boolean;

async function ensure() {
  if (model || tried) return;
  tried = true;

  if (!createModel) {
    logWarn(
      'TensorFlow Lite not available - using mock detections',
      undefined,
      'AI/Inference',
    );
    return;
  }

  try {
    // Skip model loading for web builds using webpack-defined constant
    if (typeof __IS_WEB__ !== 'undefined' && __IS_WEB__) {
      logWarn(
        'TensorFlow Lite not available in web browsers - using mock detections',
        undefined,
        'AI/Inference',
      );
      return;
    }

    // @ts-ignore asset bundling - only for native builds
    model = await createModel(require('./models/tlr_yolov8n_int8.tflite'));
    logDebug('AI model loaded successfully', undefined, 'AI/Inference');
  } catch (e) {
    logWarn('Model load failed - using mock detections', e, 'AI/Inference');
  }
}

export async function runDetector(_opts: {
  frameWidth?: number;
  frameHeight?: number;
}) {
  await ensure();
  if (!model) {
    return {objects: mockDetectionsOnce(), timestamp: Date.now()};
  }

  try {
    // Replace with real frame->tensor
    const input = new Uint8Array(1 * 384 * 640 * 3);
    const outputs = model.runSync([input]);
    const objects = postprocessYOLO(outputs[0], {conf: 0.45, iou: 0.5});
    logDebug(
      'AI inference completed',
      {objectCount: objects.length},
      'AI/Inference',
    );
    return {objects, timestamp: Date.now()};
  } catch (error) {
    logWarn('Model inference failed', error, 'AI/Inference');
    return {objects: mockDetectionsOnce(), timestamp: Date.now()};
  }
}
