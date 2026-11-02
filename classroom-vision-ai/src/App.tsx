import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { ProjectionStage } from "./components/ProjectionStage";
import { VoicePanel } from "./components/VoicePanel";
import { GestureCamera } from "./components/GestureCamera";
import { ControlPanel } from "./components/ControlPanel";
import { LibraryPanel } from "./components/LibraryPanel";
import { AIStatusCard, CommandHistory } from "./components/CommandHistory";
import { TeacherAssistant } from "./components/TeacherAssistant";
import { ShortcutDialog } from "./components/ShortcutDialog";
import { Icon } from "./components/Icon";
import { categoryLabels } from "./components/LibraryPanel";
import {
  getNextVisual,
  getPreviousVisual,
  getVisualById,
  visualLibrary,
} from "./data/visualLibrary";
import { useHandTracking } from "./hooks/useHandTracking";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { interpretWithApi } from "./utils/intent";
import type {
  CommandAction,
  CommandLogItem,
  IntentResult,
  ModelTransform,
  VisualId,
} from "./types";

const defaultTransform: ModelTransform = {
  rotationX: 0,
  rotationY: 0,
  zoom: 1,
  exploded: false,
  paused: false,
};

const controlMessages: Record<string, string> = {
  "rotate-left": "Rotated left for a different perspective.",
  "rotate-right": "Rotated right for a different perspective.",
  "zoom-in": "A closer look at the model.",
  "zoom-out": "Stepped back to the wider view.",
  reset: "The model is back to its starting view.",
  explode: "Switched the model\u2019s parts view.",
  pause: "Motion paused. Take your time to explain.",
  resume: "The model is moving again.",
  next: "Ready to explore the next model.",
  previous: "Back to the previous model.",
};

function formatTime() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

export default function App() {
  const [activeVisualId, setActiveVisualId] = useState<VisualId>("heart");
  const [transform, setTransform] = useState<ModelTransform>(() => ({
    ...defaultTransform,
    paused: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  const [projectorMode, setProjectorMode] = useState(false);
  const [lastIntent, setLastIntent] = useState<IntentResult | null>(null);
  const [history, setHistory] = useState<CommandLogItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const commandIdRef = useRef(0);
  const lastSpeechIdRef = useRef(0);
  const lastGestureIdRef = useRef(0);

  const activeVisual = useMemo(
    () => getVisualById(activeVisualId),
    [activeVisualId],
  );
  const displayedIntent = useMemo<IntentResult | null>(() => {
    if (!processing) return lastIntent;
    return {
      action: lastIntent?.action ?? "none",
      confidence: lastIntent?.confidence ?? 0.5,
      transcript: lastIntent?.transcript ?? "Listening...",
      response: "Processing teacher command...",
      keywords: lastIntent?.keywords ?? [],
      source: lastIntent?.source ?? "local",
      visualId: lastIntent?.visualId,
    };
  }, [lastIntent, processing]);

  const speech = useSpeechRecognition();
  const hand = useHandTracking();

  const addHistory = useCallback(
    (
      transcript: string,
      action: string,
      visualId: VisualId,
      confidence = 0.9,
    ) => {
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
    },
    [],
  );

  const applyAction = useCallback(
    (
      action: CommandAction,
      visualId?: VisualId,
      transcript = "Manual control",
      confidence = 0.9,
    ) => {
      let nextVisualId = visualId ?? activeVisualId;

      if (action === "next") {
        nextVisualId = getNextVisual(activeVisualId).id;
        setActiveVisualId(nextVisualId);
      } else if (action === "previous") {
        nextVisualId = getPreviousVisual(activeVisualId).id;
        setActiveVisualId(nextVisualId);
      } else if (visualId) {
        setActiveVisualId(visualId);
      }

      setTransform((current) => {
        switch (action) {
          case "rotate-left":
            return { ...current, rotationY: current.rotationY - Math.PI / 5 };
          case "rotate-right":
            return { ...current, rotationY: current.rotationY + Math.PI / 5 };
          case "rotate-up":
            return { ...current, rotationX: current.rotationX - Math.PI / 7 };
          case "rotate-down":
            return { ...current, rotationX: current.rotationX + Math.PI / 7 };
          case "zoom-in":
            return { ...current, zoom: Math.min(1.8, current.zoom + 0.18) };
          case "zoom-out":
            return { ...current, zoom: Math.max(0.62, current.zoom - 0.18) };
          case "reset":
            return {
              ...defaultTransform,
              paused: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches,
            };
          case "explode":
            return { ...current, exploded: !current.exploded };
          case "pause":
            return { ...current, paused: true };
          case "resume":
            return { ...current, paused: false };
          default:
            return current;
        }
      });

      if (action === "projector") {
        setProjectorMode((value) => !value);
      }

      if (action !== "none") {
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
        response: controlMessages[action] ?? "The view has been updated.",
        keywords: [],
        source: "local",
      });
    },
    [applyAction],
  );

  const handleSelectVisual = useCallback(
    (visualId: VisualId) => {
      const visual = getVisualById(visualId);
      setActiveVisualId(visualId);
      setLibraryOpen(false);
      setLastIntent({
        visualId,
        action: "show",
        confidence: 1,
        transcript: `Selected ${visual.shortTitle}`,
        response: `Showing ${visual.shortTitle} on the smart board.`,
        keywords: visual.keywords.slice(0, 3),
        source: "local",
      });
      addHistory(`Selected ${visual.shortTitle}`, "show", visualId, 1);
    },
    [addHistory],
  );

  useEffect(() => {
    if (!speech.lastFinal || speech.lastFinal.id === lastSpeechIdRef.current)
      return;
    lastSpeechIdRef.current = speech.lastFinal.id;
    void handleTeacherCommand(speech.lastFinal.transcript);
  }, [handleTeacherCommand, speech.lastFinal]);

  useEffect(() => {
    if (!hand.lastEvent || hand.lastEvent.id === lastGestureIdRef.current)
      return;
    lastGestureIdRef.current = hand.lastEvent.id;
    if (hand.lastEvent.name === "swipe-right") {
      applyAction("next", undefined, "Gesture: swipe right", 0.9);
    }
    if (hand.lastEvent.name === "swipe-left") {
      applyAction("previous", undefined, "Gesture: swipe left", 0.9);
    }
    if (hand.lastEvent.name === "fist") {
      applyAction("reset", undefined, "Gesture: fist reset", 0.9);
    }
  }, [applyAction, hand.lastEvent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (helpOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        setProjectorMode(false);
        setLibraryOpen(false);
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, button, a, summary, [contenteditable="true"]',
        )
      )
        return;
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      const map: Record<string, CommandAction> = {
        ArrowLeft: "rotate-left",
        ArrowRight: "rotate-right",
        ArrowUp: "rotate-up",
        ArrowDown: "rotate-down",
        "+": "zoom-in",
        "=": "zoom-in",
        "-": "zoom-out",
        e: "explode",
        r: "reset",
        n: "next",
        p: "previous",
        " ": transform.paused ? "resume" : "pause",
      };
      const action = map[event.key];
      if (action) {
        event.preventDefault();
        applyAction(action, undefined, `Keyboard: ${event.key}`, 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyAction, transform.paused, helpOpen]);

  const handleRotate = useCallback((deltaYaw: number, deltaPitch: number) => {
    setTransform((current) => ({
      ...current,
      paused: true,
      rotationY: current.rotationY + deltaYaw,
      rotationX: Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, current.rotationX + deltaPitch),
      ),
    }));
  }, []);

  return (
    <div className={projectorMode ? "app-shell projector-mode" : "app-shell"}>
      <a className="skip-link" href="#main-workspace">
        Skip to teaching workspace
      </a>
      <LibraryPanel
        activeId={activeVisualId}
        onSelect={handleSelectVisual}
        onOpenHelp={() => setHelpOpen(true)}
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
      />
      {libraryOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setLibraryOpen(false)}
          aria-label="Close model library"
        />
      )}
      <div className="workspace">
        <Header
          projectorMode={projectorMode}
          onToggleProjector={() =>
            applyAction("projector", undefined, "Button: projector mode", 1)
          }
          onOpenHelp={() => setHelpOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          sessionActive={speech.listening || hand.enabled}
          libraryOpen={libraryOpen}
        />
        <main id="main-workspace" className="workspace-content" tabIndex={-1}>
          <div className="workspace-intro">
            <div>
              <div className="workspace-eyebrow">
                <span />A SPACE FOR CURIOSITY
              </div>
              <h1>Teaching studio</h1>
              <p>Pick a model. Make it your lesson.</p>
            </div>
            <div className="studio-signature">
              <span className="signature-illustration" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>
                Small discoveries.
                <br />
                <strong>Big understanding.</strong>
              </span>
            </div>
          </div>

          <div className="studio-grid">
            <div className="stage-column">
              <ProjectionStage
                visual={activeVisual}
                transform={transform}
                gesture={hand.gesture}
                projectorMode={projectorMode}
                onRotate={handleRotate}
              >
                <ControlPanel
                  transform={transform}
                  onAction={handleDirectAction}
                />
              </ProjectionStage>
              <div className="stage-footnote">
                <span>
                  <Icon name="info" size={14} />
                  Concept model · simplified for learning
                </span>
                <button type="button" onClick={() => setHelpOpen(true)}>
                  <Icon name="keyboard" size={15} />
                  View shortcuts
                </button>
              </div>
              <div className="lesson-section">
                <section
                  className="lesson-notes"
                  aria-labelledby="lesson-notes-title"
                >
                  <div className="lesson-note-icon">
                    <Icon name="book" size={21} />
                  </div>
                  <div>
                    <div className="lesson-kicker">
                      THE LESSON, AT A GLANCE{" "}
                      <span>{categoryLabels[activeVisual.category]}</span>
                    </div>
                    <h2 id="lesson-notes-title">
                      {lessonTitles[activeVisual.id]}
                    </h2>
                    <p>{lessonDescriptions[activeVisual.id]}</p>
                    <div className="lesson-topics">
                      {lessonTopics[activeVisual.id].map((topic) => (
                        <span key={topic}>{topic}</span>
                      ))}
                    </div>
                  </div>
                </section>
                <TeacherAssistant
                  visual={activeVisual}
                  gesture={hand.gesture}
                  lastIntent={lastIntent}
                  onSubmitCommand={handleTeacherCommand}
                  processing={processing}
                />
                <CommandHistory history={history} />
              </div>
            </div>
            <aside
              className="side-stack"
              aria-label="Teaching tools"
              style={{ display: projectorMode ? "none" : undefined }}
            >
              <div className="tools-heading">
                <h2>Teaching tools</h2>
                <span>HANDS-FREE, IF YOU LIKE</span>
              </div>
              <VoicePanel
                supported={speech.supported}
                listening={speech.listening}
                interimTranscript={speech.interimTranscript}
                speechError={speech.error}
                processing={processing}
                onStart={speech.start}
                onStop={speech.stop}
                onSubmitCommand={handleTeacherCommand}
              />
              <AIStatusCard
                lastIntent={displayedIntent}
                processing={processing}
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
              <div className="tools-privacy">
                <Icon name="check" size={14} />
                <p>
                  You're in control. Camera and microphone start only when you
                  choose.
                </p>
              </div>
            </aside>
          </div>
          <footer className="workspace-footer">
            <span>
              Vision <span className="footer-dot">·</span> A little perspective
              goes a long way.
            </span>
            <span>
              Made for curious classrooms
              <Icon name="leaf" size={13} />
            </span>
          </footer>
        </main>
      </div>
      <ShortcutDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <datalist id="sample-commands">
        {Array.from(
          new Set(visualLibrary.flatMap((visual) => visual.teacherPrompts)),
        ).map((prompt) => (
          <option value={prompt} key={prompt} />
        ))}
      </datalist>
    </div>
  );
}

const lessonTitles: Record<VisualId, string> = {
  heart: "At the heart of every heartbeat.",
  osi: "Seven layers. One conversation.",
  dna: "The instructions inside every cell.",
  solar: "A neighbourhood in motion.",
  atom: "Small scale. Extraordinary structure.",
  cell: "A whole world inside a cell.",
  neural: "How connections become understanding.",
  waterCycle: "One journey. Endless possibilities.",
};
const lessonDescriptions: Record<VisualId, string> = {
  heart:
    "Explore the chambers and major vessels that keep blood moving. Rotate the heart for a new perspective, or separate its parts to look a little closer.",
  osi: "Follow a message through the seven layers of network communication, from the applications we use to the physical signals that connect us.",
  dna: "Follow the two twisting strands of DNA and the base pairs that connect them. A simple view of the structure that carries genetic information.",
  solar:
    "Discover how planets revolve around the Sun. Follow the orbits, pause the motion, and explore our solar system from a different angle.",
  atom: "Take a closer look at the nucleus and electrons in this simplified atomic model. Separate the parts to explore how they fit together.",
  cell: "Explore the cell wall, nucleus, vacuole, and chloroplasts. See where the major structures sit and discuss the role each one plays.",
  neural:
    "Follow information from input to output through a network of connected nodes. Explore how layers work together in a simple neural network.",
  waterCycle:
    "Follow water from the surface to the sky and back again. Connect evaporation, condensation, precipitation, and collection in one view.",
};
const lessonTopics: Record<VisualId, string[]> = {
  heart: ["Heart chambers", "Blood circulation", "Major vessels"],
  osi: ["Seven layers", "Network communication", "Data transmission"],
  dna: ["Double helix", "Base pairs", "Genetic information"],
  solar: ["Planetary orbits", "Revolution", "The Sun"],
  atom: ["Nucleus", "Electrons", "Atomic structure"],
  cell: ["Organelles", "Cell structure", "Plant biology"],
  neural: ["Input & output", "Hidden layers", "Connections"],
  waterCycle: ["Evaporation", "Condensation", "Precipitation"],
};
