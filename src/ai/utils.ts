export type Detection = {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  state?: 'red' | 'amber' | 'green' | 'arrow';
};
let mockToggle = 0;
export function mockDetectionsOnce(): Detection[] {
  mockToggle = (mockToggle + 1) % 40;
  if (mockToggle < 20) {
    return [
      {
        cls: 'traffic_light',
        conf: 0.55,
        bbox: [0.45, 0.15, 0.55, 0.35],
        state: 'red',
      },
    ];
  } else {
    return [
      {
        cls: 'traffic_light',
        conf: 0.58,
        bbox: [0.46, 0.16, 0.54, 0.34],
        state: 'green',
      },
    ];
  }
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
