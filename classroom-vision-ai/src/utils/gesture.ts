import type {
  GestureEvent,
  GestureName,
  GestureState,
  NormalizedLandmark,
} from "../types";

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

function alignment(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
) {
  const ab = [b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)];
  const bc = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const divisor = Math.hypot(...ab) * Math.hypot(...bc);
  return divisor > 0.000001
    ? ab.reduce((sum, value, index) => sum + value * bc[index], 0) / divisor
    : -1;
}

function idle(timestamp: number, message = "No hand detected"): GestureState {
  return {
    name: "idle",
    confidence: 0,
    x: 0.5,
    y: 0.5,
    z: 0,
    pinchDistance: 1,
    active: false,
    message,
    timestamp,
  };
}

/** Geometry uses palm-relative distances, so moving closer is not itself a pinch. */
export function classifyHandGesture(
  landmarks: NormalizedLandmark[],
  _handedness = "Right",
  timestamp = Date.now(),
): GestureState {
  if (
    landmarks.length < 21 ||
    landmarks
      .slice(0, 21)
      .some(
        (point) =>
          !point ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          (point.z !== undefined && !Number.isFinite(point.z)),
      )
  )
    return idle(timestamp);

  const wrist = landmarks[0];
  const palm = [0, 5, 9, 13, 17].reduce(
    (center, index) => ({
      x: center.x + landmarks[index].x / 5,
      y: center.y + landmarks[index].y / 5,
      z: (center.z ?? 0) + (landmarks[index].z ?? 0) / 5,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const handSize = Math.max(
    distance(wrist, landmarks[9]),
    distance(landmarks[5], landmarks[17]),
  );
  if (handSize < 0.015)
    return idle(timestamp, "Move your hand closer to the camera");

  const extended = (mcp: number, pip: number, tip: number) =>
    alignment(landmarks[mcp], landmarks[pip], landmarks[tip]) > 0.5 &&
    distance(landmarks[tip], wrist) >
      distance(landmarks[pip], wrist) + handSize * 0.12;
  const index = extended(5, 6, 8);
  const middle = extended(9, 10, 12);
  const ring = extended(13, 14, 16);
  const pinky = extended(17, 18, 20);
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length;
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const pinchDistance = distance(thumbTip, indexTip);
  const thumbExtended =
    alignment(landmarks[2], landmarks[3], thumbTip) > 0.45 &&
    distance(thumbTip, palm) > distance(landmarks[3], palm) + handSize * 0.1 &&
    distance(thumbTip, landmarks[5]) > handSize * 0.55;
  const thumbUp =
    thumbExtended &&
    thumbTip.y < landmarks[3].y - handSize * 0.18 &&
    thumbTip.y < landmarks[5].y - handSize * 0.25 &&
    landmarks[2].y - thumbTip.y > Math.abs(thumbTip.x - landmarks[2].x) * 1.2;
  const compactFingers = [8, 12, 16, 20].every(
    (tip) => distance(landmarks[tip], palm) < handSize * 0.85,
  );

  let name: GestureName = "unknown";
  let confidence = 0.5;
  let message = "Open your palm, pinch, point, or make a fist";
  if (extendedCount === 0 && thumbUp) {
    name = "thumbs-up";
    confidence = 0.88;
    message = "Hold thumbs up to show the suggested visual";
  } else if (
    extendedCount === 0 &&
    compactFingers &&
    distance(thumbTip, palm) < handSize * 0.9
  ) {
    // A closed fist naturally brings the thumb and index together.
    name = "fist";
    confidence = 0.86;
    message = "Hold a fist briefly to reset the view";
  } else if (
    pinchDistance / handSize < 0.3 &&
    (middle || ring || pinky || distance(indexTip, wrist) > handSize * 1.15)
  ) {
    name = "pinch";
    confidence = 0.9;
    message = "Pinch: move your hand to adjust the zoom";
  } else if (index && !middle && !ring && !pinky) {
    name = "point";
    confidence = 0.86;
    message = "Point: move the spotlight";
  } else if (extendedCount === 4 || (extendedCount >= 3 && thumbExtended)) {
    name = "open-palm";
    confidence = 0.88;
    message = "Open palm: move to rotate; swipe to switch models";
  }

  const position =
    name === "point"
      ? indexTip
      : name === "pinch"
        ? {
            x: (thumbTip.x + indexTip.x) / 2,
            y: (thumbTip.y + indexTip.y) / 2,
            z: ((thumbTip.z ?? 0) + (indexTip.z ?? 0)) / 2,
          }
        : palm;
  return {
    name,
    confidence,
    x: Math.min(1, Math.max(0, position.x)),
    y: Math.min(1, Math.max(0, position.y)),
    z: position.z ?? wrist.z ?? 0,
    pinchDistance,
    active: true,
    message,
    timestamp,
  };
}

type DiscreteEvent = Pick<GestureEvent, "name" | "message" | "timestamp">;
type HoldGesture = "fist" | "thumbs-up";
interface PositionSample {
  x: number;
  y: number;
  at: number;
}

/** Stateful event gating, separated from the camera for deterministic tests. */
export function createGestureEventTracker() {
  let candidate: HoldGesture | null = null;
  let candidateSince = 0;
  let latched: HoldGesture | null = null;
  let releaseSince: number | null = null;
  let previousAt: number | null = null;
  let swipeSamples: PositionSample[] = [];
  let lastSwipe = -Infinity;

  const reset = () => {
    candidate = null;
    candidateSince = 0;
    latched = null;
    releaseSince = null;
    previousAt = null;
    swipeSamples = [];
    lastSwipe = -Infinity;
  };

  const update = (
    gesture: GestureState,
    at = gesture.timestamp,
  ): DiscreteEvent | null => {
    if (!Number.isFinite(at)) return null;
    if (previousAt !== null && at < previousAt) reset();
    const gap = previousAt === null ? 0 : at - previousAt;
    previousAt = at;
    if (gap > 250) {
      candidate = null;
      swipeSamples = [];
    }
    const hold: HoldGesture | null =
      gesture.active &&
      (gesture.name === "fist" || gesture.name === "thumbs-up")
        ? gesture.name
        : null;

    if (latched && hold !== latched) {
      if (releaseSince === null) releaseSince = at;
      if (at - releaseSince >= 180) {
        latched = null;
        releaseSince = null;
      }
    } else releaseSince = null;

    if (hold && hold !== latched) {
      if (candidate !== hold) {
        candidate = hold;
        candidateSince = at;
      }
      const duration = hold === "thumbs-up" ? 650 : 300;
      if (at - candidateSince >= duration) {
        latched = hold;
        candidate = null;
        releaseSince = null;
        swipeSamples = [];
        return {
          name: hold,
          message:
            hold === "thumbs-up"
              ? "Thumbs up: show the suggested visual"
              : "Fist: reset the view",
          timestamp: at,
        };
      }
    } else candidate = null;

    if (
      !gesture.active ||
      gesture.name !== "open-palm" ||
      at - lastSwipe < 900
    ) {
      swipeSamples = [];
      return null;
    }
    const recent = swipeSamples[swipeSamples.length - 1];
    if (recent && Math.hypot(gesture.x - recent.x, gesture.y - recent.y) > 0.2)
      swipeSamples = [];
    swipeSamples = swipeSamples.filter((sample) => at - sample.at <= 650);
    swipeSamples.push({ x: gesture.x, y: gesture.y, at });
    if (swipeSamples.length < 3) return null;
    const first = swipeSamples[0];
    const duration = at - first.at;
    const dx = gesture.x - first.x;
    const dy = gesture.y - first.y;
    let pathX = 0;
    let pathY = 0;
    for (let index = 1; index < swipeSamples.length; index++) {
      pathX += Math.abs(swipeSamples[index].x - swipeSamples[index - 1].x);
      pathY += Math.abs(swipeSamples[index].y - swipeSamples[index - 1].y);
    }
    if (
      duration >= 120 &&
      Math.abs(dx) >= 0.18 &&
      Math.abs(dx) / duration >= 0.00045 &&
      Math.abs(dx) >= Math.abs(dy) * 1.8 &&
      Math.abs(dx) >= pathX * 0.8 &&
      pathY <= pathX * 0.65
    ) {
      const name = dx > 0 ? "swipe-left" : "swipe-right";
      lastSwipe = at;
      swipeSamples = [];
      return {
        name,
        message:
          dx > 0 ? "Swipe left: previous model" : "Swipe right: next model",
        timestamp: at,
      };
    }
    return null;
  };
  return { update, reset };
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
