import { Icon } from "./Icon";

export function Header({
  projectorMode,
  onToggleProjector,
  onOpenHelp,
  onOpenLibrary,
  sessionActive,
  libraryOpen,
  handEnabled,
  handLoading,
  onHandControl,
}: {
  projectorMode: boolean;
  onToggleProjector: () => void;
  onOpenHelp: () => void;
  onOpenLibrary: () => void;
  sessionActive: boolean;
  libraryOpen: boolean;
  handEnabled: boolean;
  handLoading: boolean;
  onHandControl: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-location">
        <button
          type="button"
          className="mobile-menu"
          onClick={onOpenLibrary}
          aria-label="Open model library"
          aria-expanded={libraryOpen}
          aria-controls="model-library"
        >
          <Icon name="menu" size={19} />
          <span>Models</span>
        </button>
        <span className="header-home">Workspace</span>
        <Icon name="chevron-right" size={13} />
        <span className="header-current">Presentation studio</span>
      </div>
      <div className="header-actions">
        <span className="session-indicator">
          <span className={"online-dot " + (sessionActive ? "is-live" : "")} />
          {sessionActive ? "Session active" : "Ready to present"}
        </span>
        <span className="header-divider" />
        <button
          type="button"
          id="hand-control-toggle"
          className="header-hand-button"
          onClick={onHandControl}
          aria-pressed={handEnabled}
          aria-label={
            handEnabled
              ? "Hand control settings"
              : handLoading
                ? "Camera startup settings"
                : "Start hand control"
          }
        >
          <Icon name="hand" size={17} />
          <span>{handLoading ? "Starting…" : "Hand control"}</span>
          {handEnabled && (
            <span className="header-hand-dot" aria-hidden="true" />
          )}
        </button>
        <button
          className="icon-button help-button"
          type="button"
          onClick={onOpenHelp}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Icon name="keyboard" size={19} />
        </button>
        <button
          className="present-button"
          onClick={onToggleProjector}
          type="button"
          aria-label={projectorMode ? "Exit Projector" : "Projector Mode"}
        >
          <Icon name={projectorMode ? "close" : "projector"} size={17} />
          <span>{projectorMode ? "Exit presentation" : "Present"}</span>
        </button>
      </div>
    </header>
  );
}
