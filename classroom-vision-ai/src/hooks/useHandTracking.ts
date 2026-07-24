import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyHandGesture, HAND_CONNECTIONS } from '../utils/gesture';
import type { GestureEvent, GestureState, NormalizedLandmark } from '../types';

type HandLandmarkerType = import('@mediapipe/tasks-vision').HandLandmarker;

type HandLandmarkerResultLike = {
  landmarks?: NormalizedLandmark[][];
  handednesses?: Array<Array<{ categoryName?: string; score?: number }>>;
};

const idleGesture = (): GestureState => ({
  name: 'idle',
  confidence: 0,
  x: 0.5,
  y: 0.5,
  z: 0,
  pinchDistance: 1,
  active: false,
  message: 'Camera is off',
  timestamp: Date.now(),
});

function drawHandOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks?: NormalizedLandmark[]) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const width = video.videoWidth || canvas.clientWidth;
  const height = video.videoHeight || canvas.clientHeight;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!landmarks?.length) return;

  context.save();
  context.lineWidth = 4;
  context.strokeStyle = 'rgba(68, 214, 255, 0.88)';
  context.fillStyle = 'rgba(170, 241, 255, 0.96)';
  context.shadowBlur = 18;
  context.shadowColor = 'rgba(68, 214, 255, 0.8)';

  for (const [from, to] of HAND_CONNECTIONS) {
    const a = landmarks[from];
    const b = landmarks[to];
    if (!a || !b) continue;
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  }

  for (const point of landmarks) {
    context.beginPath();
    context.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function useHandTracking() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerType | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastWristRef = useRef<{ x: number; at: number } | null>(null);
  const lastDiscreteEventAtRef = useRef(0);
  const eventCounterRef = useRef(0);

  const [gesture, setGesture] = useState<GestureState>(() => idleGesture());
  const [lastEvent, setLastEvent] = useState<GestureEvent | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emitEvent = useCallback((name: GestureState['name'], message: string) => {
    const now = Date.now();
    if (now - lastDiscreteEventAtRef.current < 900) return;
    lastDiscreteEventAtRef.current = now;
    eventCounterRef.current += 1;
    setLastEvent({ id: eventCounterRef.current, name, message, timestamp: now });
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    setEnabled(false);
    setGesture(idleGesture());
  }, []);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || !streamRef.current) {
      return;
    }

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now()) as HandLandmarkerResultLike;
      const firstHand = result.landmarks?.[0];
      const handedness = result.handednesses?.[0]?.[0]?.categoryName ?? 'Right';

      drawHandOverlay(canvas, video, firstHand);

      if (firstHand?.length) {
        const classified = classifyHandGesture(firstHand, handedness);
        const wrist = firstHand[0];
        const now = Date.now();
        const previous = lastWristRef.current;
        if (previous && now - previous.at < 650) {
          const delta = wrist.x - previous.x;
          if (Math.abs(delta) > 0.2) {
            const swipeName = delta > 0 ? 'swipe-left' : 'swipe-right';
            const eventMessage = delta > 0 ? 'Swipe left: previous model' : 'Swipe right: next model';
            const swipeGesture: GestureState = {
              ...classified,
              name: swipeName,
              confidence: 0.9,
              message: eventMessage,
              timestamp: now,
            };
            setGesture(swipeGesture);
            emitEvent(swipeName, eventMessage);
            lastWristRef.current = { x: wrist.x, at: now };
          } else {
            setGesture(classified);
          }
        } else {
          setGesture(classified);
        }

        if (classified.name === 'fist') {
          emitEvent('fist', 'Fist: reset the model');
        }

        lastWristRef.current = { x: wrist.x, at: now };
      } else {
        setGesture({ ...idleGesture(), message: 'No hand detected' });
      }
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [emitEvent]);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available in this browser.');
      }

      const [{ FilesetResolver, HandLandmarker }, stream] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 960 },
            height: { ideal: 540 },
            facingMode: 'user',
          },
          audio: false,
        }),
      ]);

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element is not ready.');
      }

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      }

      setEnabled(true);
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start hand tracking.';
      setError(message);
      stop();
    } finally {
      setLoading(false);
    }
  }, [detectLoop, stop]);

  useEffect(() => stop, [stop]);

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
