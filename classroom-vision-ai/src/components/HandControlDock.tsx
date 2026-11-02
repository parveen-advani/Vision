import type { RefObject } from "react";
import type { GestureState } from "../types";
import { GestureCamera } from "./GestureCamera";
import { Icon } from "./Icon";

export function HandControlDock({
  open,
  onToggle,
  armed,
  onToggleArmed,
  target,
  pendingTitle,
  processing,
  feedback,
  videoRef,
  canvasRef,
  enabled,
  loading,
  error,
  gesture,
  onStart,
  onStop,
}: {
  open: boolean;
  onToggle: () => void;
  armed: boolean;
  onToggleArmed: () => void;
  target: "model" | "engine" | "session";
  pendingTitle?: string;
  processing: boolean;
  feedback: string;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  enabled: boolean;
  loading: boolean;
  error: string | null;
  gesture: GestureState;
  onStart: () => void;
  onStop: () => void;
}) {
  const visible = open || enabled || loading;
  const tracking = enabled && armed && gesture.active;
  return (
    <aside
      className={
        "hand-dock" + (visible ? " is-visible" : "") + (open ? " is-open" : "")
      }
      aria-label="Hand controls"
      aria-hidden={!visible}
    >
      <div className="hand-dock-top">
        <span className={"hand-dock-icon" + (tracking ? " is-tracking" : "")}>
          <Icon name="hand" size={18} />
        </span>
        <div>
          <strong>
            {loading
              ? "Starting hand control"
              : enabled
                ? armed
                  ? "Hand control is on"
                  : "Hand control paused"
                : "Present with your hands"}
          </strong>
          <span>
            {loading
              ? "Waiting for camera and tracking"
              : enabled
                ? armed
                  ? gesture.active
                    ? "Hand detected"
                    : "Bring one hand into view"
                  : "Camera stays on. Your view stays still."
                : "Rotate, zoom and present from where you stand."}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="hand-camera-details"
          aria-label={open ? "Minimize hand controls" : "Expand hand controls"}
        >
          <Icon name={open ? "minus" : "chevron-down"} size={17} />
        </button>
      </div>
      {/* Keep the same video/canvas mounted when the dock or projector layout changes. */}
      <div
        id="hand-camera-details"
        className="hand-dock-details"
        style={{ display: open ? undefined : "none" }}
      >
        <GestureCamera
          videoRef={videoRef}
          canvasRef={canvasRef}
          enabled={enabled}
          loading={loading}
          error={error}
          gesture={gesture}
          onStart={onStart}
          onStop={onStop}
          target={target}
          showStopButton={false}
        />
        <p className="hand-position-tip">
          Keep one hand in view with good lighting. Use slow palm movements to
          rotate; a quick sideways swipe navigates.
        </p>
      </div>
      {enabled && (
        <>
          <div className="hand-dock-actions">
            <button type="button" onClick={onToggleArmed} aria-pressed={!armed}>
              <Icon name={armed ? "pause" : "play"} size={14} />
              {armed ? "Pause gestures" : "Resume gestures"}
            </button>
            <button type="button" onClick={onStop}>
              <Icon name="close" size={14} />
              Stop camera
            </button>
          </div>
          <p className="hand-dock-hint">
            {target === "model"
              ? "Palm: rotate · Pinch + move: zoom · Fist: reset"
              : target === "engine"
                ? "Swipe left / right: previous / next engine stroke"
                : "Swipe left / right: previous / next session visual"}
          </p>
          {pendingTitle && !processing && (
            <div className="hand-approval">
              <Icon name="check" size={15} />
              <div>
                <strong>Hold a thumbs-up to show</strong>
                <span>{pendingTitle}</span>
              </div>
            </div>
          )}
          {feedback && (
            <p className="hand-feedback" role="status">
              {feedback}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
