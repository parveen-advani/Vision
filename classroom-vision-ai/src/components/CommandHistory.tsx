import type { CSSProperties } from 'react';
import type { CommandLogItem, IntentResult } from '../types';

export function AIStatusCard({ lastIntent }: { lastIntent: IntentResult | null }) {
  return (
    <article className="panel ai-status-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AI brain</p>
          <h3>Intent processor</h3>
        </div>
        <span className="chip">{lastIntent?.source ?? 'local'} engine</span>
      </div>

      <div className="intent-summary">
        <span>Last detected command</span>
        <strong>{lastIntent?.transcript || 'No command processed yet'}</strong>
        <p>{lastIntent?.response || 'Start voice recognition, type a command, or select a model from the library.'}</p>
      </div>

      <div className="confidence-ring" style={{ '--confidence': `${Math.round((lastIntent?.confidence ?? 0) * 100)}%` } as CSSProperties}>
        <span>{Math.round((lastIntent?.confidence ?? 0) * 100)}%</span>
        <small>confidence</small>
      </div>
    </article>
  );
}

export function CommandHistory({ history }: { history: CommandLogItem[] }) {
  return (
    <article className="panel history-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Class session</p>
          <h3>Command timeline</h3>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="empty-state">Commands will appear here during the lesson.</p>
      ) : (
        <ol className="history-list">
          {history.slice(0, 6).map((item) => (
            <li key={item.id}>
              <time>{item.at}</time>
              <strong>{item.action}</strong>
              <span>{item.visualTitle}</span>
              <p>{item.transcript}</p>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
