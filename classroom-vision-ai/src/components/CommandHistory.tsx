import { Icon } from "./Icon";
import type { CommandLogItem, IntentResult } from "../types";

export function AIStatusCard({
  lastIntent,
  processing = false,
}: {
  lastIntent: IntentResult | null;
  processing?: boolean;
}) {
  const unrecognized = lastIntent?.action === "none";

  return (
    <div
      className="command-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-state={
        processing ? "processing" : unrecognized ? "unrecognized" : "ready"
      }
    >
      <span className="command-feedback-icon">
        <Icon
          name={
            processing
              ? "clock"
              : !lastIntent
                ? "command"
                : unrecognized
                  ? "info"
                  : "check"
          }
          size={17}
        />
      </span>
      <div className="command-feedback-copy">
        <span className="command-feedback-label">
          {processing
            ? "Working on your command"
            : !lastIntent
              ? "Ready when you are"
              : unrecognized
                ? "Try another command"
                : "Command applied"}
        </span>
        <p>
          {processing
            ? "Updating your teaching board…"
            : lastIntent?.response ||
              "Choose a model, or tell us what you want to explore."}
        </p>
      </div>
    </div>
  );
}

const actionLabels: Record<string, string> = {
  show: "Show model",
  "rotate-left": "Rotate left",
  "rotate-right": "Rotate right",
  "rotate-up": "Tilt up",
  "rotate-down": "Tilt down",
  "zoom-in": "Zoom in",
  "zoom-out": "Zoom out",
  reset: "Reset view",
  next: "Next model",
  previous: "Previous model",
  explode: "Toggle parts view",
  focus: "Focus model",
  projector: "Toggle presentation mode",
  pause: "Pause animation",
  resume: "Resume animation",
};

function commandTitle(item: CommandLogItem) {
  if (/^(Button|Keyboard):/.test(item.transcript)) {
    return actionLabels[item.action] ?? item.action.replace(/-/g, " ");
  }
  return item.transcript;
}

export function CommandHistory({ history }: { history: CommandLogItem[] }) {
  return (
    <details className="history-panel">
      <summary className="history-summary">
        <span className="history-summary-title">
          <Icon name="clock" size={16} />
          Session history
        </span>
        <span className="history-summary-meta">
          {history.length === 0
            ? "No commands yet"
            : history.length +
              (history.length === 1 ? " command" : " commands")}
          <Icon name="chevron-down" size={16} />
        </span>
      </summary>
      {history.length === 0 ? (
        <div className="history-empty">
          <Icon name="command" size={20} />
          <p>Your commands will appear here as you teach.</p>
        </div>
      ) : (
        <>
          <ol className="history-list" aria-label="Recent commands">
            {history.slice(0, 8).map((item) => (
              <li key={item.id}>
                <span className="history-item-icon">
                  <Icon name="check" size={14} />
                </span>
                <div className="history-item-copy">
                  <strong>{commandTitle(item)}</strong>
                  <span>{item.visualTitle}</span>
                </div>
                <time>{item.at}</time>
              </li>
            ))}
          </ol>
          {history.length > 8 && (
            <p className="history-limit">
              Showing your 8 most recent commands.
            </p>
          )}
        </>
      )}
    </details>
  );
}
