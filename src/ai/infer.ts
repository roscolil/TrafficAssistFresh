import {postprocessYOLO, mockDetectionsOnce} from './utils';

// Safe import for TensorFlow Lite
let createModel: any;
try {
  createModel = require('react-native-fast-tflite').createModel;
} catch (error) {
  console.warn('react-native-fast-tflite not available:', error);
}

let model: ReturnType<typeof createModel> | null = null;
let tried = false;

// Webpack-defined constant for web builds
declare const __IS_WEB__: boolean;

async function ensure() {
  if (model || tried) return;
  tried = true;

  if (!createModel) {
    console.warn('TensorFlow Lite not available; using mock detections.');
    return;
  }

  try {
    // Skip model loading for web builds using webpack-defined constant
    if (typeof __IS_WEB__ !== 'undefined' && __IS_WEB__) {
      console.warn(
        'TensorFlow Lite not available in web browsers; using mock detections.',
      );
      return;
    }

    // @ts-ignore asset bundling - only for native builds
    model = await createModel(require('./models/tlr_yolov8n_int8.tflite'));
  } catch (e) {
    console.warn('Model load failed; using mock detections.', e);
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
    return {objects, timestamp: Date.now()};
  } catch (error) {
    console.warn('Model inference failed:', error);
    return {objects: mockDetectionsOnce(), timestamp: Date.now()};
  }
}
