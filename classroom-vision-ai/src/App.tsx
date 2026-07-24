import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { ProjectionStage } from './components/ProjectionStage';
import { VoicePanel } from './components/VoicePanel';
import { GestureCamera } from './components/GestureCamera';
import { ControlPanel } from './components/ControlPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { AIStatusCard, CommandHistory } from './components/CommandHistory';
import { TeacherAssistant } from './components/TeacherAssistant';
import { SystemFlow } from './components/SystemFlow';
import { Footer } from './components/Footer';
import { getNextVisual, getPreviousVisual, getVisualById, visualLibrary } from './data/visualLibrary';
import { useHandTracking } from './hooks/useHandTracking';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { interpretWithApi } from './utils/intent';
import type { CommandAction, CommandLogItem, IntentResult, ModelTransform, VisualId } from './types';

const defaultTransform: ModelTransform = {
  rotationX: 0,
  rotationY: 0,
  zoom: 1,
  exploded: false,
  paused: false,
};

function formatTime() {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

export default function App() {
  const [activeVisualId, setActiveVisualId] = useState<VisualId>('heart');
  const [transform, setTransform] = useState<ModelTransform>(defaultTransform);
  const [projectorMode, setProjectorMode] = useState(false);
  const [lastIntent, setLastIntent] = useState<IntentResult | null>(null);
  const [history, setHistory] = useState<CommandLogItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const commandIdRef = useRef(0);
  const lastSpeechIdRef = useRef(0);

  const activeVisual = useMemo(() => getVisualById(activeVisualId), [activeVisualId]);
  const displayedIntent = useMemo<IntentResult | null>(() => {
    if (!processing) return lastIntent;
    return {
      action: lastIntent?.action ?? 'none',
      confidence: lastIntent?.confidence ?? 0.5,
      transcript: lastIntent?.transcript ?? 'Listening...',
      response: 'Processing teacher command...',
      keywords: lastIntent?.keywords ?? [],
      source: lastIntent?.source ?? 'local',
      visualId: lastIntent?.visualId,
    };
  }, [lastIntent, processing]);

  const speech = useSpeechRecognition();
  const hand = useHandTracking();

  const addHistory = useCallback((transcript: string, action: string, visualId: VisualId, confidence = 0.9) => {
    commandIdRef.current += 1;
    const visual = getVisualById(visualId);
    setHistory((items) => [
      {
        id: commandIdRef.current,
        at: formatTime(),
        transcript,
        action,
        visualTitle: visual.shortTitle,
        confidence,
      },
      ...items,
    ]);
  }, []);

  const applyAction = useCallback(
    (action: CommandAction, visualId?: VisualId, transcript = 'Manual control', confidence = 0.9) => {
      let nextVisualId = visualId ?? activeVisualId;

      if (action === 'next') {
        nextVisualId = getNextVisual(activeVisualId).id;
        setActiveVisualId(nextVisualId);
      } else if (action === 'previous') {
        nextVisualId = getPreviousVisual(activeVisualId).id;
        setActiveVisualId(nextVisualId);
      } else if (visualId) {
        setActiveVisualId(visualId);
      }

      setTransform((current) => {
        switch (action) {
          case 'rotate-left':
            return { ...current, rotationY: current.rotationY - Math.PI / 5 };
          case 'rotate-right':
            return { ...current, rotationY: current.rotationY + Math.PI / 5 };
          case 'rotate-up':
            return { ...current, rotationX: current.rotationX - Math.PI / 7 };
          case 'rotate-down':
            return { ...current, rotationX: current.rotationX + Math.PI / 7 };
          case 'zoom-in':
            return { ...current, zoom: Math.min(1.8, current.zoom + 0.18) };
          case 'zoom-out':
            return { ...current, zoom: Math.max(0.62, current.zoom - 0.18) };
          case 'reset':
            return defaultTransform;
          case 'explode':
            return { ...current, exploded: !current.exploded };
          case 'pause':
            return { ...current, paused: true };
          case 'resume':
            return { ...current, paused: false };
          default:
            return current;
        }
      });

      if (action === 'projector') {
        setProjectorMode((value) => !value);
      }

      if (action !== 'none') {
        addHistory(transcript, action, nextVisualId, confidence);
      }
    },
    [activeVisualId, addHistory],
  );

  const handleTeacherCommand = useCallback(
    async (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) return;

      setProcessing(true);
      try {
        const intent = await interpretWithApi(clean);
        setLastIntent(intent);
        applyAction(intent.action, intent.visualId, clean, intent.confidence);
      } finally {
        setProcessing(false);
      }
    },
    [applyAction],
  );

  const handleDirectAction = useCallback(
    (action: string) => {
      applyAction(action as CommandAction, undefined, `Button: ${action}`, 1);
      setLastIntent({
        action: action as CommandAction,
        confidence: 1,
        transcript: `Button: ${action}`,
        response: `Applied ${action}.`,
        keywords: [],
        source: 'local',
      });
    },
    [applyAction],
  );

  const handleSelectVisual = useCallback(
    (visualId: VisualId) => {
      const visual = getVisualById(visualId);
      setActiveVisualId(visualId);
      setLastIntent({
        visualId,
        action: 'show',
        confidence: 1,
        transcript: `Selected ${visual.shortTitle}`,
        response: `Showing ${visual.shortTitle} on the smart board.`,
        keywords: visual.keywords.slice(0, 3),
        source: 'local',
      });
      addHistory(`Selected ${visual.shortTitle}`, 'show', visualId, 1);
    },
    [addHistory],
  );

  useEffect(() => {
    if (!speech.lastFinal || speech.lastFinal.id === lastSpeechIdRef.current) return;
    lastSpeechIdRef.current = speech.lastFinal.id;
    void handleTeacherCommand(speech.lastFinal.transcript);
  }, [handleTeacherCommand, speech.lastFinal]);

  useEffect(() => {
    if (!hand.lastEvent) return;
    if (hand.lastEvent.name === 'swipe-right') {
      applyAction('next', undefined, 'Gesture: swipe right', 0.9);
    }
    if (hand.lastEvent.name === 'swipe-left') {
      applyAction('previous', undefined, 'Gesture: swipe left', 0.9);
    }
    if (hand.lastEvent.name === 'fist') {
      applyAction('reset', undefined, 'Gesture: fist reset', 0.9);
    }
  }, [applyAction, hand.lastEvent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, CommandAction> = {
        ArrowLeft: 'rotate-left',
        ArrowRight: 'rotate-right',
        ArrowUp: 'rotate-up',
        ArrowDown: 'rotate-down',
        '+': 'zoom-in',
        '=': 'zoom-in',
        '-': 'zoom-out',
        e: 'explode',
        r: 'reset',
        n: 'next',
        p: 'previous',
        ' ': transform.paused ? 'resume' : 'pause',
      };
      const action = map[event.key];
      if (action) {
        event.preventDefault();
        applyAction(action, undefined, `Keyboard: ${event.key}`, 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyAction, transform.paused]);

  return (
    <main className={projectorMode ? 'app-shell projector-mode' : 'app-shell'}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <Header projectorMode={projectorMode} onToggleProjector={() => applyAction('projector', undefined, 'Button: projector mode', 1)} />

      {!projectorMode && <SystemFlow />}

      <section className="dashboard-grid">
        <ProjectionStage visual={activeVisual} transform={transform} gesture={hand.gesture} projectorMode={projectorMode} />

        {!projectorMode && (
          <aside className="side-stack">
            <VoicePanel
              supported={speech.supported}
              listening={speech.listening}
              interimTranscript={speech.interimTranscript}
              speechError={speech.error}
              onStart={speech.start}
              onStop={speech.stop}
              onSubmitCommand={handleTeacherCommand}
            />
            <GestureCamera
              videoRef={hand.videoRef}
              canvasRef={hand.canvasRef}
              enabled={hand.enabled}
              loading={hand.loading}
              error={hand.error}
              gesture={hand.gesture}
              onStart={hand.start}
              onStop={hand.stop}
            />
          </aside>
        )}
      </section>

      {!projectorMode && (
        <section className="lower-grid">
          <ControlPanel transform={transform} onAction={handleDirectAction} />
          <LibraryPanel activeId={activeVisualId} onSelect={handleSelectVisual} />
          <AIStatusCard lastIntent={displayedIntent} />
          <CommandHistory history={history} />
        </section>
      )}

      <TeacherAssistant visual={activeVisual} gesture={hand.gesture} lastIntent={lastIntent} />
      {!projectorMode && <Footer />}

      <datalist id="sample-commands">
        {visualLibrary.flatMap((visual) => visual.teacherPrompts).map((prompt) => (
          <option value={prompt} key={prompt} />
        ))}
      </datalist>
    </main>
  );
}
