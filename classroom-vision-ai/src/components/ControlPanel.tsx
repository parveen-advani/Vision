import type { ModelTransform } from '../types';

type ControlPanelProps = {
  transform: ModelTransform;
  onAction: (action: string) => void;
};

export function ControlPanel({ transform, onAction }: ControlPanelProps) {
  return (
    <article className="panel control-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Manual override</p>
          <h3>Smart board controls</h3>
        </div>
      </div>

      <div className="control-grid">
        <button type="button" onClick={() => onAction('rotate-left')}>Rotate Left</button>
        <button type="button" onClick={() => onAction('rotate-right')}>Rotate Right</button>
        <button type="button" onClick={() => onAction('zoom-in')}>Zoom In</button>
        <button type="button" onClick={() => onAction('zoom-out')}>Zoom Out</button>
        <button type="button" onClick={() => onAction('explode')}>{transform.exploded ? 'Merge Parts' : 'Explode Parts'}</button>
        <button type="button" onClick={() => onAction(transform.paused ? 'resume' : 'pause')}>{transform.paused ? 'Resume' : 'Pause'}</button>
        <button type="button" onClick={() => onAction('previous')}>Previous</button>
        <button type="button" onClick={() => onAction('next')}>Next</button>
        <button className="wide" type="button" onClick={() => onAction('reset')}>Reset Model View</button>
      </div>
    </article>
  );
}
