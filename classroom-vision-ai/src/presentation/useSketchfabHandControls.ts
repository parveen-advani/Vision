import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GestureState } from "../types";
import { gestureMotion } from "../utils/handMotion";

export interface SketchfabCamera {
  position: number[];
  target: number[];
}

export interface SketchfabCameraApi {
  getCameraLookAt?: (
    callback: (error: unknown, camera: SketchfabCamera) => void,
  ) => void;
  setCameraLookAt?: (
    position: number[],
    target: number[],
    duration: number,
    callback?: (error: unknown) => void,
  ) => void;
  setEnableCameraConstraints?: (enabled: boolean) => void;
}

type ControlStatus = "loading" | "ready" | "unavailable";
interface CameraSession {
  api: SketchfabCameraApi;
  initial: SketchfabCamera | null;
  initialAspect: number;
  camera: SketchfabCamera | null;
  previous: GestureState | null;
  generation: number;
  frame: number | null;
  minimumRadius: number;
  maximumRadius: number;
}

const copyCamera = (camera: SketchfabCamera): SketchfabCamera => ({
  position: [...camera.position],
  target: [...camera.target],
});
const radiusOf = (camera: SketchfabCamera) =>
  Math.hypot(
    ...camera.position.map((value, index) => value - camera.target[index]),
  );
const validCamera = (
  camera: SketchfabCamera | undefined,
): camera is SketchfabCamera =>
  !!camera &&
  Array.isArray(camera.position) &&
  Array.isArray(camera.target) &&
  camera.position.length === 3 &&
  camera.target.length === 3 &&
  [...camera.position, ...camera.target].every(Number.isFinite) &&
  Number.isFinite(radiusOf(camera)) &&
  radiusOf(camera) > 1e-8;
const aspectOf = (frame: HTMLIFrameElement | null) => {
  const bounds = frame?.getBoundingClientRect();
  return bounds && bounds.width > 0 && bounds.height > 0
    ? bounds.width / bounds.height
    : 1;
};
function stopSession(session: CameraSession) {
  session.generation += 1;
  if (session.frame !== null) cancelAnimationFrame(session.frame);
  session.frame = null;
  session.previous = null;
  session.camera = null;
}

/** Camera-only controls; the creator's geometry and native viewer stay intact. */
export function useSketchfabHandControls(
  api: SketchfabCameraApi | null,
  frame: RefObject<HTMLIFrameElement | null>,
  gesture: GestureState | undefined,
  enabled: boolean,
  resetToken: number,
) {
  const sessionRef = useRef<CameraSession | null>(null);
  const lastReset = useRef(resetToken);
  const [status, setStatus] = useState<ControlStatus>("loading");

  useEffect(() => {
    if (!api) {
      setStatus("loading");
      return;
    }
    if (!api.getCameraLookAt || !api.setCameraLookAt) {
      setStatus("unavailable");
      return;
    }
    const session: CameraSession = {
      api,
      initial: null,
      initialAspect: 1,
      camera: null,
      previous: null,
      generation: 0,
      frame: null,
      minimumRadius: 0,
      maximumRadius: Infinity,
    };
    sessionRef.current = session;
    setStatus("loading");
    const timeout = window.setTimeout(() => {
      if (sessionRef.current === session) setStatus("unavailable");
    }, 6000);
    try {
      api.getCameraLookAt((error, camera) => {
        if (sessionRef.current !== session) return;
        clearTimeout(timeout);
        if (error || !validCamera(camera)) {
          setStatus("unavailable");
          return;
        }
        session.initial = copyCamera(camera);
        session.initialAspect = aspectOf(frame.current);
        setStatus("ready");
      });
    } catch {
      clearTimeout(timeout);
      setStatus("unavailable");
    }
    return () => {
      clearTimeout(timeout);
      stopSession(session);
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [api, frame]);

  // Resize framing is also a camera change. Rebase any active gesture on that view.
  const rebaseCamera = useCallback((camera: SketchfabCamera) => {
    const session = sessionRef.current;
    if (!session || !validCamera(camera)) return;
    session.generation += 1;
    if (session.frame !== null) cancelAnimationFrame(session.frame);
    session.frame = null;
    session.camera = copyCamera(camera);
    const radius = radiusOf(camera);
    session.minimumRadius = Math.min(session.minimumRadius, radius);
    session.maximumRadius = Math.max(session.maximumRadius, radius);
  }, []);

  useEffect(() => {
    if (lastReset.current === resetToken) return;
    const session = sessionRef.current;
    if (!session?.initial || status !== "ready") return;
    lastReset.current = resetToken;
    stopSession(session);
    const initial = session.initial;
    const scale = session.initialAspect / aspectOf(frame.current);
    const position = initial.position.map(
      (value, index) =>
        initial.target[index] + (value - initial.target[index]) * scale,
    );
    try {
      session.api.setEnableCameraConstraints?.(false);
      session.api.setCameraLookAt?.(position, initial.target, 0.3, (error) => {
        if (error && sessionRef.current === session) setStatus("unavailable");
      });
    } catch {
      setStatus("unavailable");
    }
  }, [resetToken, status, frame]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || session.api !== api) return;
    if (
      !enabled ||
      status !== "ready" ||
      !gesture?.active ||
      (gesture.name !== "open-palm" && gesture.name !== "pinch")
    ) {
      stopSession(session);
      return;
    }
    const previous = session.previous;
    const acquired =
      !previous ||
      previous.name !== gesture.name ||
      gesture.timestamp - previous.timestamp > 250 ||
      gesture.timestamp <= previous.timestamp;
    if (acquired) {
      stopSession(session);
      session.previous = gesture;
      const generation = session.generation;
      // A fresh read respects mouse/touch orbit, zoom and creator annotations between gestures.
      try {
        session.api.getCameraLookAt?.((error, camera) => {
          if (
            sessionRef.current !== session ||
            session.generation !== generation
          )
            return;
          if (error || !validCamera(camera)) {
            stopSession(session);
            setStatus("unavailable");
            return;
          }
          session.camera = copyCamera(camera);
          const radius = radiusOf(camera);
          const originalRadius = session.initial
            ? radiusOf(session.initial)
            : radius;
          session.minimumRadius = Math.min(radius, originalRadius * 0.15);
          session.maximumRadius = Math.max(radius, originalRadius * 8);
          try {
            session.api.setEnableCameraConstraints?.(false);
          } catch {
            stopSession(session);
            setStatus("unavailable");
          }
        });
      } catch {
        stopSession(session);
        setStatus("unavailable");
      }
      return;
    }
    session.previous = gesture;
    const motion = gestureMotion(previous, gesture);
    if (
      !session.camera ||
      (!motion.yaw && !motion.pitch && motion.zoomFactor === 1)
    )
      return;
    const camera = session.camera;
    const [x, y, z] = camera.position.map(
      (value, index) => value - camera.target[index],
    );
    const radius = radiusOf(camera);
    // Sketchfab's world uses Z as up. Orbit the camera opposite the model's horizontal rotation.
    const azimuth = Math.atan2(y, x) - motion.yaw;
    const elevation = Math.max(
      -Math.PI / 2 + 0.08,
      Math.min(
        Math.PI / 2 - 0.08,
        Math.asin(Math.max(-1, Math.min(1, z / radius))) + motion.pitch,
      ),
    );
    const nextRadius = Math.max(
      session.minimumRadius,
      Math.min(session.maximumRadius, radius / motion.zoomFactor),
    );
    const horizontal = Math.cos(elevation) * nextRadius;
    session.camera = {
      position: [
        camera.target[0] + Math.cos(azimuth) * horizontal,
        camera.target[1] + Math.sin(azimuth) * horizontal,
        camera.target[2] + Math.sin(elevation) * nextRadius,
      ],
      target: [...camera.target],
    };
    if (session.frame !== null) return;
    session.frame = requestAnimationFrame(() => {
      session.frame = null;
      if (sessionRef.current !== session || !session.camera) return;
      try {
        session.api.setCameraLookAt?.(
          session.camera.position,
          session.camera.target,
          0.06,
          (error) => {
            if (error && sessionRef.current === session) {
              stopSession(session);
              setStatus("unavailable");
            }
          },
        );
      } catch {
        stopSession(session);
        setStatus("unavailable");
      }
    });
  }, [api, enabled, gesture, status]);

  return { status, rebaseCamera };
}
