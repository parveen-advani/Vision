import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  SketchfabCamera,
  SketchfabCameraApi,
} from "./useSketchfabHandControls";

type ResultCallback = (error: unknown) => void;
export interface ModelViewerControlApi extends SketchfabCameraApi {
  addEventListener?: (event: string, callback: () => void) => void;
  removeEventListener?: (event: string, callback: () => void) => void;
  getAnimations?: (
    callback: (error: unknown, animations: unknown[]) => void,
  ) => void;
  play?: (callback?: ResultCallback) => void;
  pause?: (callback?: ResultCallback) => void;
}

export type ViewerControlStatus = "loading" | "ready" | "unavailable" | "error";
interface Capability {
  status: ViewerControlStatus;
  busy: boolean;
  error: string;
}
type CameraAction =
  | "zoom-in"
  | "zoom-out"
  | "rotate-left"
  | "rotate-right"
  | "reset";
interface Runtime {
  moveCamera: (action: CameraAction) => void;
  togglePlayback: () => void;
}
const loading = (): Capability => ({
  status: "loading",
  busy: false,
  error: "",
});
const radiusOf = (camera: SketchfabCamera) =>
  Math.hypot(
    ...camera.position.map((value, index) => value - camera.target[index]),
  );
function validCamera(
  camera: SketchfabCamera | undefined,
): camera is SketchfabCamera {
  return (
    !!camera &&
    Array.isArray(camera.position) &&
    Array.isArray(camera.target) &&
    camera.position.length === 3 &&
    camera.target.length === 3 &&
    [...camera.position, ...camera.target].every(Number.isFinite) &&
    Number.isFinite(radiusOf(camera)) &&
    radiusOf(camera) > 1e-8
  );
}
const copyCamera = (camera: SketchfabCamera): SketchfabCamera => ({
  position: [...camera.position],
  target: [...camera.target],
});
function frameAspect(frame: HTMLIFrameElement | null) {
  const bounds = frame?.getBoundingClientRect();
  return bounds && bounds.width > 0 && bounds.height > 0
    ? bounds.width / bounds.height
    : 1;
}

/** Native Vision controls backed exclusively by the official viewer API. */
export function useModelViewerControls(
  api: ModelViewerControlApi | null,
  frame: RefObject<HTMLIFrameElement | null>,
  modelUid: string,
  onCameraChange?: (camera: SketchfabCamera) => void,
) {
  const runtimeRef = useRef<Runtime | null>(null);
  const cameraChanged = useRef(onCameraChange);
  cameraChanged.current = onCameraChange;
  const [camera, setCamera] = useState<Capability>(loading);
  const [animation, setAnimation] = useState(() => ({
    ...loading(),
    playing: false,
    count: 0,
  }));

  useEffect(() => {
    setCamera(loading());
    setAnimation({ ...loading(), playing: false, count: 0 });
    if (!api) return;

    let disposed = false;
    let initialCamera: SketchfabCamera | null = null;
    let initialAspect = 1;
    let cameraReady = false;
    let cameraBusy = false;
    let animationReady = false;
    let animationBusy = false;
    let playing = false;
    const timers = new Set<number>();
    const listeners: Array<[string, () => void]> = [];
    const runtime: Runtime = { moveCamera, togglePlayback };
    runtimeRef.current = runtime;
    const alive = () => !disposed && runtimeRef.current === runtime;

    function later(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (alive()) callback();
      }, delay);
      timers.add(timer);
      return timer;
    }
    function request<T>(
      invoke: (done: (error: unknown, result?: T) => void) => void,
      complete: (error: unknown, result?: T) => void,
    ) {
      let settled = false;
      const timeout = later(
        () => finish(new Error("The viewer did not respond.")),
        5000,
      );
      function finish(error: unknown, result?: T) {
        if (settled || !alive()) return;
        settled = true;
        clearTimeout(timeout);
        timers.delete(timeout);
        complete(error, result);
      }
      try {
        invoke(finish);
      } catch (error) {
        finish(error);
      }
    }
    function cameraFailure() {
      cameraReady = false;
      cameraBusy = false;
      setCamera({
        status: "error",
        busy: false,
        error:
          "Camera controls could not respond. You can still drag inside the model.",
      });
    }
    function moveCamera(action: CameraAction) {
      if (!alive() || !cameraReady || cameraBusy || !initialCamera) return;
      cameraBusy = true;
      setCamera({ status: "ready", busy: true, error: "" });
      const initial = initialCamera;
      const aspectScale = initialAspect / frameAspect(frame.current);
      const writeCamera = (next: SketchfabCamera) => {
        if (!alive()) return;
        try {
          api!.setEnableCameraConstraints?.(false);
        } catch {
          cameraFailure();
          return;
        }
        request<void>(
          (done) =>
            api!.setCameraLookAt!(next.position, next.target, 0.2, done),
          (error) => {
            if (error) {
              cameraFailure();
              return;
            }
            cameraChanged.current?.(copyCamera(next));
            // The SDK callback acknowledges the start, not the end, of the move.
            later(() => {
              cameraBusy = false;
              setCamera({ status: "ready", busy: false, error: "" });
            }, 220);
          },
        );
      };
      if (action === "reset") {
        writeCamera({
          position: initial.position.map(
            (value, index) =>
              initial.target[index] +
              (value - initial.target[index]) * aspectScale,
          ),
          target: [...initial.target],
        });
        return;
      }
      // Read the current view so toolbar actions preserve prior mouse, touch and hand gestures.
      request<SketchfabCamera>(
        (done) => api!.getCameraLookAt!(done),
        (error, current) => {
          if (error || !validCamera(current)) {
            cameraFailure();
            return;
          }
          const offset = current.position.map(
            (value, index) => value - current.target[index],
          );
          if (action === "zoom-in" || action === "zoom-out") {
            const radius = radiusOf(current);
            const baseline = radiusOf(initial) * aspectScale;
            const minimum = Math.min(radius, baseline * 0.15);
            const maximum = Math.max(radius, baseline * 8);
            const nextRadius = Math.max(
              minimum,
              Math.min(
                maximum,
                radius * (action === "zoom-in" ? 1 / 1.2 : 1.2),
              ),
            );
            writeCamera({
              position: offset.map(
                (value, index) =>
                  current.target[index] + (value * nextRadius) / radius,
              ),
              target: [...current.target],
            });
            return;
          }
          const angle = ((action === "rotate-left" ? 1 : -1) * Math.PI) / 12;
          const [x, y, z] = offset;
          writeCamera({
            position: [
              current.target[0] + x * Math.cos(angle) - y * Math.sin(angle),
              current.target[1] + x * Math.sin(angle) + y * Math.cos(angle),
              current.target[2] + z,
            ],
            target: [...current.target],
          });
        },
      );
    }

    function animationFailure() {
      animationReady = false;
      animationBusy = false;
      setAnimation((value) => ({
        ...value,
        status: "error",
        busy: false,
        error:
          "Animation controls could not respond. Reopen the model to retry.",
      }));
    }
    function setPlaying(value: boolean) {
      if (!alive()) return;
      playing = value;
      setAnimation((state) => ({ ...state, playing: value }));
    }
    function togglePlayback() {
      if (!alive() || !animationReady || animationBusy) return;
      animationBusy = true;
      const nextPlaying = !playing;
      setAnimation((value) => ({ ...value, busy: true, error: "" }));
      request<void>(
        (done) => (nextPlaying ? api!.play! : api!.pause!).call(api, done),
        (error) => {
          if (error) {
            animationFailure();
            return;
          }
          animationBusy = false;
          playing = nextPlaying;
          setAnimation((value) => ({
            ...value,
            busy: false,
            playing: nextPlaying,
          }));
        },
      );
    }

    if (api.getCameraLookAt && api.setCameraLookAt) {
      request<SketchfabCamera>(
        (done) => api.getCameraLookAt!(done),
        (error, value) => {
          if (error || !validCamera(value)) {
            cameraFailure();
            return;
          }
          initialCamera = copyCamera(value);
          initialAspect = frameAspect(frame.current);
          cameraReady = true;
          setCamera({ status: "ready", busy: false, error: "" });
        },
      );
    } else setCamera({ status: "unavailable", busy: false, error: "" });

    if (api.getAnimations && api.play && api.pause) {
      for (const [event, callback] of [
        ["animationPlay", () => setPlaying(true)],
        ["animationStop", () => setPlaying(false)],
      ] as Array<[string, () => void]>) {
        try {
          api.addEventListener?.(event, callback);
          listeners.push([event, callback]);
        } catch {
          /* Action callbacks still keep playback state current. */
        }
      }
      request<unknown[]>(
        (done) => api.getAnimations!(done),
        (error, tracks) => {
          if (error || !Array.isArray(tracks)) {
            animationFailure();
            return;
          }
          const count = tracks.filter(
            (track) =>
              Array.isArray(track) &&
              typeof track[0] === "string" &&
              typeof track[2] === "number" &&
              track[2] > 0,
          ).length;
          if (!count) {
            setAnimation({
              status: "unavailable",
              busy: false,
              error: "",
              count: 0,
              playing: false,
            });
            return;
          }
          setAnimation((value) => ({ ...value, count }));
          // Establish a known paused state even if a creator configured animation autoplay.
          request<void>(
            (done) => api.pause!(done),
            (pauseError) => {
              if (pauseError) {
                animationFailure();
                return;
              }
              animationReady = true;
              playing = false;
              setAnimation({
                status: "ready",
                busy: false,
                error: "",
                count,
                playing: false,
              });
            },
          );
        },
      );
    } else
      setAnimation({
        status: "unavailable",
        busy: false,
        error: "",
        count: 0,
        playing: false,
      });

    return () => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      for (const [event, callback] of listeners) {
        try {
          api.removeEventListener?.(event, callback);
        } catch {
          /* Stale callbacks are also guarded by alive(). */
        }
      }
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [api, frame, modelUid]);

  const zoomIn = useCallback(
    () => runtimeRef.current?.moveCamera("zoom-in"),
    [],
  );
  const zoomOut = useCallback(
    () => runtimeRef.current?.moveCamera("zoom-out"),
    [],
  );
  const rotateLeft = useCallback(
    () => runtimeRef.current?.moveCamera("rotate-left"),
    [],
  );
  const rotateRight = useCallback(
    () => runtimeRef.current?.moveCamera("rotate-right"),
    [],
  );
  const reset = useCallback(() => runtimeRef.current?.moveCamera("reset"), []);
  const togglePlayback = useCallback(
    () => runtimeRef.current?.togglePlayback(),
    [],
  );
  return {
    camera: {
      ...camera,
      available: camera.status === "ready",
      zoomIn,
      zoomOut,
      rotateLeft,
      rotateRight,
      reset,
    },
    animation: {
      ...animation,
      available: animation.status === "ready",
      togglePlayback,
    },
  };
}
