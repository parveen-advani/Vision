import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyHandGesture,
  createGestureEventTracker,
  HAND_CONNECTIONS,
} from "../utils/gesture";
import type { GestureEvent, GestureState, NormalizedLandmark } from "../types";

type HandLandmarkerType = import("@mediapipe/tasks-vision").HandLandmarker;
type HandLandmarkerResultLike = {
  landmarks?: NormalizedLandmark[][];
  handedness?: Array<Array<{ categoryName?: string }>>;
  handednesses?: Array<Array<{ categoryName?: string }>>;
};

const idleGesture = (message = "Camera is off"): GestureState => ({
  name: "idle",
  confidence: 0,
  x: 0.5,
  y: 0.5,
  z: 0,
  pinchDistance: 1,
  active: false,
  message,
  timestamp: Date.now(),
});

function closeLandmarker(landmarker: HandLandmarkerType | null) {
  try {
    landmarker?.close();
  } catch {
    /* Already-disposed native resources. */
  }
}

function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Camera access was blocked. Allow it in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera was found. Connect a camera and try again.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "The camera could not open. Close other apps using it and try again.";
  return error instanceof Error
    ? error.message
    : "Hand tracking could not start. Please try again.";
}

function drawHandOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks?: NormalizedLandmark[],
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = video.videoWidth || canvas.width || 640;
  const height = video.videoHeight || canvas.height || 360;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  context.clearRect(0, 0, width, height);
  if (!landmarks || landmarks.length < 21) return;
  context.save();
  context.lineWidth = Math.max(2, width / 300);
  context.strokeStyle = "rgba(209, 239, 181, 0.92)";
  context.fillStyle = "#f5ffe9";
  for (const [from, to] of HAND_CONNECTIONS) {
    const a = landmarks[from];
    const b = landmarks[to];
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  }
  for (const point of landmarks) {
    context.beginPath();
    context.arc(
      point.x * width,
      point.y * height,
      Math.max(3, width / 180),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

export function useHandTracking() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerType | null>(null);
  const cpuFallbackRef = useRef<(() => Promise<HandLandmarkerType>) | null>(
    null,
  );
  const trackCleanupRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceTimeRef = useRef(-Infinity);
  const eventCounterRef = useRef(0);
  const eventTrackerRef = useRef(createGestureEventTracker());
  const [gesture, setGesture] = useState<GestureState>(() => idleGesture());
  const [lastEvent, setLastEvent] = useState<GestureEvent | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resource cleanup does not update React state, so it is also safe on unmount.
  const releaseResources = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    trackCleanupRef.current?.();
    trackCleanupRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (videoRef.current && videoRef.current.srcObject === stream) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    const landmarker = landmarkerRef.current;
    landmarkerRef.current = null;
    cpuFallbackRef.current = null;
    closeLandmarker(landmarker);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    lastVideoTimeRef.current = -1;
    lastInferenceTimeRef.current = -Infinity;
    eventTrackerRef.current.reset();
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
    releaseResources();
    if (!mountedRef.current) return;
    setEnabled(false);
    setLoading(false);
    setLastEvent(null);
    setGesture(idleGesture());
    setError(null);
  }, [releaseResources]);

  const failSession = useCallback(
    (generation: number, reason: unknown) => {
      if (!mountedRef.current || generationRef.current !== generation) return;
      generationRef.current += 1;
      startingRef.current = false;
      releaseResources();
      setEnabled(false);
      setLoading(false);
      setLastEvent(null);
      setGesture(idleGesture());
      setError(cameraError(reason));
    },
    [releaseResources],
  );

  const detectLoop = useCallback(
    (generation: number): void => {
      if (!mountedRef.current || generationRef.current !== generation) return;
      rafRef.current = null;
      const stream = streamRef.current;
      const landmarker = landmarkerRef.current;
      if (!stream || !landmarker) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // A temporarily missing/replaced preview must not permanently end tracking.
      if (video) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          void video.play().catch((reason) => {
            if (videoRef.current === video) failSession(generation, reason);
          });
        }
        const now = performance.now();
        if (
          video.readyState >= 2 &&
          video.currentTime !== lastVideoTimeRef.current &&
          now - lastInferenceTimeRef.current >= 32
        ) {
          lastVideoTimeRef.current = video.currentTime;
          lastInferenceTimeRef.current = now;
          try {
            const result = landmarker.detectForVideo(
              video,
              now,
            ) as HandLandmarkerResultLike;
            const firstHand = result.landmarks?.[0];
            if (canvas) drawHandOverlay(canvas, video, firstHand);
            const handedness =
              (result.handedness ?? result.handednesses)?.[0]?.[0]
                ?.categoryName ?? "Right";
            const classified = classifyHandGesture(firstHand ?? [], handedness);
            const event = eventTrackerRef.current.update(classified, now);
            setGesture(classified);
            if (event) {
              eventCounterRef.current += 1;
              setLastEvent({
                ...event,
                id: eventCounterRef.current,
                timestamp: Date.now(),
              });
            }
          } catch (reason) {
            const createCpu = cpuFallbackRef.current;
            cpuFallbackRef.current = null;
            if (!createCpu) {
              failSession(generation, reason);
              return;
            }
            landmarkerRef.current = null;
            closeLandmarker(landmarker);
            eventTrackerRef.current.reset();
            setGesture(idleGesture("Switching to compatible hand tracking…"));
            setLoading(true);
            void createCpu()
              .then((cpu) => {
                if (
                  !mountedRef.current ||
                  generationRef.current !== generation
                ) {
                  closeLandmarker(cpu);
                  return;
                }
                landmarkerRef.current = cpu;
                lastVideoTimeRef.current = -1;
                setLoading(false);
                rafRef.current = requestAnimationFrame(() =>
                  detectLoop(generation),
                );
              })
              .catch((cpuError) => failSession(generation, cpuError));
            return;
          }
        }
      }
      if (mountedRef.current && generationRef.current === generation) {
        rafRef.current = requestAnimationFrame(() => detectLoop(generation));
      }
    },
    [failSession],
  );

  const start = useCallback(async () => {
    if (!mountedRef.current || startingRef.current || streamRef.current) return;
    const generation = ++generationRef.current;
    const current = () =>
      mountedRef.current && generationRef.current === generation;
    startingRef.current = true;
    setLoading(true);
    setError(null);
    setLastEvent(null);
    eventTrackerRef.current.reset();

    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access is unavailable. Open this app on localhost or HTTPS in a browser with camera support.",
        );
      // A late permission result must stop its own camera stream.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          facingMode: "user",
        },
        audio: false,
      });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const tracks = stream.getVideoTracks();
      const onEnded = () =>
        failSession(
          generation,
          new Error(
            "The camera disconnected or stopped. Reconnect it and start again.",
          ),
        );
      tracks.forEach((track) => track.addEventListener("ended", onEnded));
      trackCleanupRef.current = () =>
        tracks.forEach((track) => track.removeEventListener("ended", onEnded));
      const video = videoRef.current;
      if (!video)
        throw new Error(
          "Camera preview is not ready. Try starting the camera again.",
        );
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      if (!current()) return;

      const { FilesetResolver, HandLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      if (!current()) return;
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      if (!current()) return;
      const create = (delegate: "GPU" | "CPU") =>
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate,
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      let landmarker: HandLandmarkerType;
      let usedGpu = true;
      try {
        landmarker = await create("GPU");
      } catch {
        if (!current()) return;
        usedGpu = false;
        landmarker = await create("CPU");
      }
      if (!current()) {
        closeLandmarker(landmarker);
        return;
      }
      landmarkerRef.current = landmarker;
      cpuFallbackRef.current = usedGpu ? () => create("CPU") : null;
      lastVideoTimeRef.current = -1;
      lastInferenceTimeRef.current = -Infinity;
      setEnabled(true);
      setGesture(idleGesture("Show one hand to control the model"));
      rafRef.current = requestAnimationFrame(() => detectLoop(generation));
    } catch (reason) {
      failSession(generation, reason);
    } finally {
      if (current()) {
        startingRef.current = false;
        setLoading(false);
      }
    }
  }, [detectLoop, failSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      startingRef.current = false;
      releaseResources();
    };
  }, [releaseResources]);

  return {
    videoRef,
    canvasRef,
    gesture,
    lastEvent,
    enabled,
    loading,
    error,
    start,
    stop,
  };
}
