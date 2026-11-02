import type { ModelTransform } from "../types";
import { Icon, type IconName } from "./Icon";

export function ControlPanel({
  transform,
  onAction,
}: {
  transform: ModelTransform;
  onAction: (action: string) => void;
}) {
  const control = (
    action: string,
    label: string,
    icon: IconName,
    disabled = false,
  ) => (
    <button
      className="icon-button"
      type="button"
      onClick={() => onAction(action)}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      <Icon name={icon} size={18} />
    </button>
  );
  return (
    <div className="model-toolbar" role="toolbar" aria-label="Model controls">
      <div className="toolbar-group toolbar-navigation">
        {control("previous", "Previous", "chevron-left")}
        {control("next", "Next", "chevron-right")}
      </div>
      <span className="toolbar-divider" />
      <div className="toolbar-group">
        {control("rotate-left", "Rotate Left", "rotate-left")}
        {control("rotate-right", "Rotate Right", "rotate-right")}
      </div>
      <span className="toolbar-divider" />
      <div className="toolbar-group toolbar-zoom">
        {control("zoom-out", "Zoom Out", "minus", transform.zoom <= 0.62)}
        <output aria-label="Zoom level">
          {Math.round(transform.zoom * 100)}%
        </output>
        {control("zoom-in", "Zoom In", "plus", transform.zoom >= 1.8)}
      </div>
      <span className="toolbar-divider" />
      <div className="toolbar-group">
        {control(
          transform.paused ? "resume" : "pause",
          transform.paused ? "Resume" : "Pause",
          transform.paused ? "play" : "pause",
        )}
        {control("reset", "Reset Model View", "reset")}
      </div>
      <button
        className={"parts-button " + (transform.exploded ? "is-active" : "")}
        type="button"
        aria-label={transform.exploded ? "Merge Parts" : "Explode Parts"}
        aria-pressed={transform.exploded}
        onClick={() => onAction("explode")}
      >
        <Icon name="layers" size={16} />
        <span>{transform.exploded ? "Merge parts" : "Explore parts"}</span>
      </button>
    </div>
  );
}
