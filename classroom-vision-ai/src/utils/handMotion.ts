import type { GestureState } from "../types";

export interface HandMotion {
  yaw: number;
  pitch: number;
  zoomFactor: number;
}
const still = (): HandMotion => ({ yaw: 0, pitch: 0, zoomFactor: 1 });
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/** Relative motion preserves the current view when a hand is released or reacquired. */
export function gestureMotion(
  previous: GestureState | null | undefined,
  current: GestureState,
): HandMotion {
  if (!previous?.active || !current.active || previous.name !== current.name)
    return still();
  const elapsed = current.timestamp - previous.timestamp;
  if (
    elapsed <= 0 ||
    elapsed > 250 ||
    ![current.x, current.y, previous.x, previous.y].every(Number.isFinite)
  )
    return still();
  const dx = previous.x - current.x; // Match the mirrored camera preview.
  const dy = current.y - previous.y;
  if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) return still();
  if (current.name === "open-palm") {
    return {
      yaw: Math.abs(dx) > 0.0015 ? clamp(dx * 4, 0.35) : 0,
      pitch: Math.abs(dy) > 0.0015 ? clamp(dy * 3, 0.25) : 0,
      zoomFactor: 1,
    };
  }
  if (current.name === "pinch") {
    // Holding a pinch acts as a clutch: move upward to zoom in, downward to zoom out.
    return {
      yaw: 0,
      pitch: 0,
      zoomFactor: Math.abs(dy) > 0.0015 ? Math.exp(clamp(-dy * 3.5, 0.2)) : 1,
    };
  }
  return still();
}
