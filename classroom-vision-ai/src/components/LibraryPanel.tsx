import { visualLibrary } from '../data/visualLibrary';
import type { VisualId } from '../types';

export function LibraryPanel({ activeId, onSelect }: { activeId: VisualId; onSelect: (id: VisualId) => void }) {
  return (
    <article className="panel library-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Model library</p>
          <h3>Ready classroom visuals</h3>
        </div>
      </div>

      <div className="library-list">
        {visualLibrary.map((visual) => (
          <button
            key={visual.id}
            className={visual.id === activeId ? 'library-card active' : 'library-card'}
            type="button"
            onClick={() => onSelect(visual.id)}
          >
            <span>{visual.category.replace('-', ' ')}</span>
            <strong>{visual.shortTitle}</strong>
            <small>{visual.subtitle}</small>
          </button>
        ))}
      </div>
    </article>
  );
}
