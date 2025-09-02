// Web TensorFlow Lite mock - uses mock detections
export const createModel = (modelPath) => {
  return Promise.resolve({
    runSync: (inputs) => {
      // Return mock YOLO outputs for web demo
      return [{
        // Mock detection data - replace with actual model output format
        data: new Float32Array([
          0.5, 0.3, 0.2, 0.4, 0.8, 0.1, 0.2, // x, y, w, h, conf, class_probs...
          0.3, 0.6, 0.15, 0.3, 0.6, 0.05, 0.1,
        ])
      }];
    }
  });
};

export default { createModel };
