import type { GestureName, GestureState, NormalizedLandmark } from '../types';

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

const fingerExtended = (landmarks: NormalizedLandmark[], tip: number, pip: number) =>
  landmarks[tip].y < landmarks[pip].y - 0.018;

export function classifyHandGesture(landmarks: NormalizedLandmark[], handedness = 'Right'): GestureState {
  const now = Date.now();
  if (landmarks.length < 21) {
    return {
      name: 'idle',
      confidence: 0,
      x: 0.5,
      y: 0.5,
      z: 0,
      pinchDistance: 1,
      active: false,
      message: 'No hand detected',
      timestamp: now,
    };
  }

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const pinchDistance = distance(thumbTip, indexTip);

  const index = fingerExtended(landmarks, 8, 6);
  const middle = fingerExtended(landmarks, 12, 10);
  const ring = fingerExtended(landmarks, 16, 14);
  const pinky = fingerExtended(landmarks, 20, 18);

  const thumbOut = handedness === 'Left'
    ? thumbTip.x > landmarks[3].x + 0.02
    : thumbTip.x < landmarks[3].x - 0.02;

  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length + (thumbOut ? 1 : 0);

  let name: GestureName = 'unknown';
  let confidence = 0.55;
  let message = 'Tracking hand movement';

  if (pinchDistance < 0.055) {
    name = 'pinch';
    confidence = 0.92;
    message = 'Pinch detected: zooming the model';
  } else if (index && !middle && !ring && !pinky) {
    name = 'point';
    confidence = 0.86;
    message = 'Point detected: spotlight follows your finger';
  } else if (extendedCount >= 4) {
    name = 'open-palm';
    confidence = 0.88;
    message = 'Open palm: rotate the model by moving your hand';
  } else if (extendedCount <= 1 && pinchDistance > 0.09) {
    name = 'fist';
    confidence = 0.8;
    message = 'Fist detected: reset gesture ready';
  }

  return {
    name,
    confidence,
    x: indexTip.x,
    y: indexTip.y,
    z: indexTip.z ?? wrist.z ?? 0,
    pinchDistance,
    active: true,
    message,
    timestamp: now,
  };
}

export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];
