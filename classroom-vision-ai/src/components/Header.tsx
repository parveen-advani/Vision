export function Header({ projectorMode, onToggleProjector }: { projectorMode: boolean; onToggleProjector: () => void }) {
  return (
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">
        <span />
      </div>
      <div className="brand-copy">
        <p className="eyebrow">Classroom Vision AI</p>
        <h1>Voice + Gesture Powered 3D Teaching Board</h1>
      </div>
      <button className="ghost-button header-action" onClick={onToggleProjector} type="button">
        {projectorMode ? 'Exit Projector' : 'Projector Mode'}
      </button>
    </header>
  );
}
