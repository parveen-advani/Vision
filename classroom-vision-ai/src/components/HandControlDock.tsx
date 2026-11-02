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
        <span
          className={"hand-dock-icon" + (tracking ? " is-tracking" : "")}
          role="img"
          aria-label={
            tracking
              ? "Hand detected"
              : enabled
                ? armed
                  ? "Camera on, waiting for a hand"
                  : "Gesture control paused"
                : "Hand control"
          }
          title={
            tracking
              ? "Hand detected"
              : enabled
                ? armed
                  ? "Camera on, waiting for a hand"
                  : "Gesture control paused"
                : "Hand control"
          }
        >
          <Icon name="hand" size={18} />
        </span>
        <div className="hand-dock-status">
          <strong>
            {loading
              ? open
                ? "Starting hand control"
                : "Starting camera"
              : enabled
                ? armed
                  ? open
                    ? "Hand control is on"
                    : "Hand control"
                  : "Hand control paused"
                : "Present with your hands"}
          </strong>
          <span className="hand-dock-description">
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
        {!open && (enabled || loading) && (
          <div className="hand-dock-quick-actions">
            {enabled && (
              <button
                type="button"
                onClick={onToggleArmed}
                aria-pressed={!armed}
                aria-label={armed ? "Pause gestures" : "Resume gestures"}
                title={armed ? "Pause gestures" : "Resume gestures"}
              >
                <Icon name={armed ? "pause" : "play"} size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onStop}
              aria-label={loading ? "Cancel camera startup" : "Stop camera"}
              title={loading ? "Cancel camera startup" : "Stop camera"}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="hand-camera-details"
          aria-label={open ? "Minimize hand controls" : "Expand hand controls"}
          title={open ? "Minimize hand controls" : "Expand hand controls"}
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
          {open && (
            <div className="hand-dock-actions">
              <button
                type="button"
                onClick={onToggleArmed}
                aria-pressed={!armed}
                aria-label={armed ? "Pause gestures" : "Resume gestures"}
              >
                <Icon name={armed ? "pause" : "play"} size={14} />
                {armed ? "Pause gestures" : "Resume gestures"}
              </button>
              <button type="button" onClick={onStop}>
                <Icon name="close" size={14} />
                Stop camera
              </button>
            </div>
          )}
          {open && (
            <p className="hand-dock-hint">
              {target === "model"
                ? "Palm: rotate · Pinch + move: zoom · Fist: reset"
                : target === "engine"
                  ? "Swipe left / right: previous / next engine stroke"
                  : "Swipe left / right: previous / next session visual"}
            </p>
          )}
          {pendingTitle && !processing && (
            <div className="hand-approval">
              <Icon name="check" size={15} />
              <div>
                <strong>
                  {open ? "Hold a thumbs-up to show" : "Thumbs-up to show"}
                </strong>
                <span title={pendingTitle}>{pendingTitle}</span>
              </div>
            </div>
          )}
          {feedback && (
            <p
              className="hand-feedback"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              title={feedback}
            >
              {feedback}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
