import { useId } from "react";
import type { RefObject } from "react";
import { Icon } from "./Icon";
import type { GestureName, GestureState } from "../types";

type GestureCameraProps = {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  enabled: boolean;
  loading: boolean;
  error: string | null;
  gesture: GestureState;
  onStart: () => void;
  onStop: () => void;
};

const gestureLabels: Record<GestureName, string> = {
  idle: "Looking for a hand",
  "open-palm": "Open palm · rotate",
  point: "Point · spotlight",
  pinch: "Pinch · zoom",
  fist: "Fist · reset",
  "swipe-left": "Swipe left · previous",
  "swipe-right": "Swipe right · next",
  "two-hands": "Two hands detected",
  unknown: "Move your hand into view",
};

export function GestureCamera({
  videoRef,
  canvasRef,
  enabled,
  loading,
  error,
  gesture,
  onStart,
  onStop,
}: GestureCameraProps) {
  const headingId = useId();

  return (
    <section className="tool-card camera-panel" aria-labelledby={headingId}>
      <div className="tool-card-heading">
        <h3 id={headingId}>
          <Icon name="hand" size={17} />
          Gesture control
        </h3>
        <span className={"tool-status" + (enabled ? " is-active" : "")}>
          {loading ? "Starting" : enabled ? "Camera on" : "Off"}
        </span>
      </div>

      <p className="tool-description">Use your hands to explore the model.</p>
      <div
        className={"camera-frame" + (enabled ? " is-active" : "")}
        aria-busy={loading}
      >
        <video
          ref={videoRef}
          className="camera-video"
          muted
          playsInline
          autoPlay
          aria-label="Live camera preview"
        />
        <canvas ref={canvasRef} className="camera-canvas" aria-hidden="true" />
        {!enabled && (
          <div className="camera-placeholder">
            <span className="camera-placeholder-icon" aria-hidden="true">
              <Icon name="hand" size={32} />
            </span>
            <strong>
              {loading ? "Getting the camera ready…" : "Teach with a gesture"}
            </strong>
            <span>
              {loading
                ? "This may take a moment."
                : "Your camera preview will appear here."}
            </span>
          </div>
        )}
      </div>

      {enabled && (
        <div className="gesture-readout">
          <Icon name="hand" size={15} />
          <span>
            {gesture.active
              ? gestureLabels[gesture.name]
              : "Looking for a hand"}
          </span>
        </div>
      )}

      <button
        className="tool-secondary-button"
        type="button"
        onClick={enabled ? onStop : onStart}
        disabled={loading}
        aria-pressed={enabled}
      >
        <Icon name={enabled ? "close" : "camera"} size={17} />
        {loading
          ? "Starting camera…"
          : enabled
            ? "Stop camera"
            : "Start camera"}
      </button>
      {error && (
        <p className="tool-notice tool-notice--error" role="alert">
          {error}
        </p>
      )}

      <details className="gesture-guide">
        <summary>
          Gesture guide
          <Icon name="chevron-down" size={15} />
        </summary>
        <dl>
          <div>
            <dt>Open palm</dt>
            <dd>Move to rotate</dd>
          </div>
          <div>
            <dt>Pinch</dt>
            <dd>Zoom the model</dd>
          </div>
          <div>
            <dt>Point</dt>
            <dd>Move the spotlight</dd>
          </div>
          <div>
            <dt>Fist</dt>
            <dd>Reset the view</dd>
          </div>
          <div>
            <dt>Swipe left / right</dt>
            <dd>Switch models</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
