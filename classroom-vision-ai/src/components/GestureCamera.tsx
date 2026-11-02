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
  target?: "model" | "engine" | "session";
  showStopButton?: boolean;
};

const gestureLabels: Record<GestureName, string> = {
  idle: "Looking for a hand",
  "open-palm": "Open palm · rotate",
  point: "Point · spotlight",
  pinch: "Pinch · zoom",
  fist: "Fist · reset",
  "thumbs-up": "Thumbs-up · show suggestion",
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
  target = "model",
  showStopButton = true,
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

      <p className="tool-description">
        Start once, then control the board while you present.
      </p>
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

      {(!enabled || showStopButton) && (
        <button
          className="tool-secondary-button"
          type="button"
          onClick={enabled || loading ? onStop : onStart}
          aria-pressed={enabled}
        >
          <Icon name={enabled ? "close" : "camera"} size={17} />
          {loading
            ? "Cancel camera startup"
            : enabled
              ? "Stop camera"
              : "Start camera"}
        </button>
      )}
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
            <dd>
              {target === "model"
                ? "Move slowly to rotate"
                : "Use a quick swipe to navigate"}
            </dd>
          </div>
          <div>
            <dt>Pinch</dt>
            <dd>Hold, move up / down to zoom 3D</dd>
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
            <dd>
              {target === "model"
                ? "Switch built-in models or session visuals"
                : target === "engine"
                  ? "Change engine stroke"
                  : "Switch session visuals"}
            </dd>
          </div>
          <div>
            <dt>Thumbs-up</dt>
            <dd>Hold to show a pending suggestion</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
