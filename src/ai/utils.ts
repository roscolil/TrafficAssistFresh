export type Detection = {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  state?: 'red' | 'amber' | 'green' | 'arrow';
};

let mockToggle = 0;
let lastChangeTime = Date.now();
let currentDetections: Detection[] = [];

export function mockDetectionsOnce(): Detection[] {
  const now = Date.now();

  // Change detections every 3-4 seconds for more realistic timing
  if (now - lastChangeTime > 3000 + Math.random() * 1000) {
    mockToggle = (mockToggle + 1) % 5;
    lastChangeTime = now;

    // Create realistic traffic light scenarios
    switch (mockToggle) {
      case 0: // Single red light ahead
        currentDetections = [
          {
            cls: 'traffic_light',
            conf: 0.82 + Math.random() * 0.15,
            bbox: [
              0.42 + Math.random() * 0.16,
              0.12 + Math.random() * 0.08,
              0.52 + Math.random() * 0.16,
              0.28 + Math.random() * 0.08,
            ],
            state: 'red',
          },
        ];
        break;

      case 1: // Green light, closer
        currentDetections = [
          {
            cls: 'traffic_light',
            conf: 0.89 + Math.random() * 0.1,
            bbox: [
              0.38 + Math.random() * 0.24,
              0.15 + Math.random() * 0.1,
              0.56 + Math.random() * 0.24,
              0.35 + Math.random() * 0.1,
            ],
            state: 'green',
          },
        ];
        break;

      case 2: // Two traffic lights (intersection)
        currentDetections = [
          {
            cls: 'traffic_light',
            conf: 0.76 + Math.random() * 0.2,
            bbox: [
              0.25 + Math.random() * 0.1,
              0.18 + Math.random() * 0.05,
              0.35 + Math.random() * 0.1,
              0.32 + Math.random() * 0.05,
            ],
            state: 'red',
          },
          {
            cls: 'traffic_light',
            conf: 0.68 + Math.random() * 0.25,
            bbox: [
              0.65 + Math.random() * 0.1,
              0.16 + Math.random() * 0.06,
              0.75 + Math.random() * 0.1,
              0.3 + Math.random() * 0.06,
            ],
            state: 'green',
          },
        ];
        break;

      case 3: // Amber warning
        currentDetections = [
          {
            cls: 'traffic_light',
            conf: 0.73 + Math.random() * 0.2,
            bbox: [
              0.44 + Math.random() * 0.12,
              0.08 + Math.random() * 0.06,
              0.54 + Math.random() * 0.12,
              0.25 + Math.random() * 0.06,
            ],
            state: 'amber',
          },
        ];
        break;

      case 4: // No detections (clear road)
        currentDetections = [];
        break;
    }
  }

  // Add slight movement/noise to existing detections for realism
  return currentDetections.map(detection => ({
    ...detection,
    bbox: [
      Math.max(
        0,
        Math.min(1, detection.bbox[0] + (Math.random() - 0.5) * 0.01),
      ),
      Math.max(
        0,
        Math.min(1, detection.bbox[1] + (Math.random() - 0.5) * 0.01),
      ),
      Math.max(
        0,
        Math.min(1, detection.bbox[2] + (Math.random() - 0.5) * 0.01),
      ),
      Math.max(
        0,
        Math.min(1, detection.bbox[3] + (Math.random() - 0.5) * 0.01),
      ),
    ] as [number, number, number, number],
    conf: Math.max(
      0.4,
      Math.min(0.99, detection.conf + (Math.random() - 0.5) * 0.05),
    ),
  }));
}
export function postprocessYOLO(
  _raw: any,
  _opts: {conf: number; iou: number},
): Detection[] {
  return [];
}
export function estimateDistanceMeters(
  bbox: [number, number, number, number],
): number | null {
  const [x1, y1, x2, y2] = bbox;
  const h = Math.max(0.001, y2 - y1);
  const k = 500;
  return Math.max(5, Math.min(k / h, 250));
}
