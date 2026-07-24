import { useMemo } from 'react';
import type { GestureState, IntentResult, VisualEntry } from '../types';

export function TeacherAssistant({
  visual,
  gesture,
  lastIntent,
}: {
  visual: VisualEntry;
  gesture: GestureState;
  lastIntent: IntentResult | null;
}) {
  const guidance = useMemo(() => {
    if (gesture.active && gesture.name !== 'idle' && gesture.name !== 'unknown') {
      return gesture.message;
    }
    if (lastIntent?.response) {
      return lastIntent.response;
    }
    return `Ready to teach ${visual.shortTitle}. Say “show OSI model”, “zoom in”, or “explode parts”.`;
  }, [gesture, lastIntent, visual.shortTitle]);

  return (
    <aside className="assistant-card" aria-live="polite">
      <div className="assistant-orb">
        <span />
      </div>
      <div>
        <p className="eyebrow">Jarvis-style assistant</p>
        <strong>{guidance}</strong>
        <div className="assistant-prompts">
          {visual.teacherPrompts.slice(0, 3).map((prompt) => (
            <span key={prompt}>{prompt}</span>
          ))}
        </div>
      </div>
    </aside>
  );
}
