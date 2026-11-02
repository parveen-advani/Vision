import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Header } from "./components/Header";
import { HandControlDock } from "./components/HandControlDock";
import { ControlPanel } from "./components/ControlPanel";
import { LibraryPanel } from "./components/LibraryPanel";
import { CommandHistory } from "./components/CommandHistory";
import { TeacherAssistant } from "./components/TeacherAssistant";
import { ShortcutDialog } from "./components/ShortcutDialog";
import { Icon } from "./components/Icon";
import { SessionBrief } from "./presentation/SessionBrief";
import { CopilotPanel } from "./presentation/CopilotPanel";
import { ConceptBoard, WelcomeBoard } from "./presentation/ConceptBoard";
import {
  ExternalModels,
  ModelViewer,
  featuredEngine,
} from "./presentation/ExternalModels";
import type { ExternalModel } from "./presentation/types";
import {
  usePresentation,
  downloadSession,
} from "./presentation/usePresentation";
import { categoryLabels } from "./components/LibraryPanel";
import {
  getNextVisual,
  getPreviousVisual,
  getVisualById,
  visualLibrary,
} from "./data/visualLibrary";
import { useHandTracking } from "./hooks/useHandTracking";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { gestureMotion } from "./utils/handMotion";
import { interpretWithApi } from "./utils/intent";
import type {
  CommandAction,
  CommandLogItem,
  IntentResult,
  GestureState,
  ModelTransform,
  VisualId,
} from "./types";

const ProjectionStage = lazy(() =>
  import("./components/ProjectionStage").then((module) => ({
    default: module.ProjectionStage,
  })),
);

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
  const session = usePresentation();
  const [boardMode, setBoardMode] = useState<
    "welcome" | "model" | "concept" | "external"
  >("welcome");
  const [externalModel, setExternalModel] = useState<ExternalModel | null>(
    null,
  );
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
  const [handPanelOpen, setHandPanelOpen] = useState(false);
  const [gestureArmed, setGestureArmed] = useState(true);
  const [handFeedback, setHandFeedback] = useState("");
  const [externalResetToken, setExternalResetToken] = useState(0);
  const [engineNavigation, setEngineNavigation] = useState<{
    id: number;
    action: "next" | "previous" | "reset";
  }>();
  const previousHand = useRef<GestureState | null>(null);
  const commandIdRef = useRef(0);
  const lastSpeechIdRef = useRef(0);
  const lastGestureIdRef = useRef(0);

  const activeVisual = useMemo(
    () => getVisualById(activeVisualId),
    [activeVisualId],
  );
  const speech = useSpeechRecognition(
    session.context.language === "hi" ? "hi-IN" : "en-IN",
  );
  const hand = useHandTracking();
  const controlsActive =
    hand.enabled && gestureArmed && !helpOpen && !libraryOpen;
  const activeGesture = controlsActive
    ? hand.gesture
    : { ...hand.gesture, active: false };
  const engineBoard =
    boardMode === "concept" && session.activeCard?.plan.kind === "engine";
  const startHandControl = () => {
    setHandPanelOpen(true);
    setGestureArmed(true);
    void hand.start();
  };
  const stopHandControl = () => {
    setGestureArmed(false);
    previousHand.current = null;
    hand.stop();
    if (!handPanelOpen) document.getElementById("hand-control-toggle")?.focus();
  };
  const nativeBoard =
    boardMode === "model" ||
    (boardMode === "concept" && session.activeCard?.plan.kind === "model");
  useEffect(() => {
    if (!session.activeCard) return;
    setBoardMode("concept");
    if (session.activeCard.plan.modelId)
      setActiveVisualId(session.activeCard.plan.modelId);
  }, [session.activeCard]);
  useEffect(() => {
    if (boardMode === "model")
      session.setBoardContext({
        title: activeVisual.shortTitle,
        takeaway: activeVisual.explanation.slice(0, 600),
        kind: "model",
      });
    else if (boardMode === "external" && externalModel)
      session.setBoardContext({
        title: externalModel.title,
        takeaway: "A detailed 3D model by " + externalModel.author,
        kind: "model",
      });
    else if (boardMode === "concept" && session.activeCard)
      session.setBoardContext({
        title: session.activeCard.plan.title,
        takeaway: session.activeCard.plan.takeaway,
        kind: session.activeCard.plan.kind,
      });
    else session.setBoardContext(null);
  }, [
    boardMode,
    activeVisual,
    externalModel,
    session.activeCard,
    session.setBoardContext,
  ]);
  const showExternal = (model: ExternalModel) => {
    setExternalModel(model);
    setBoardMode("external");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const stopListening = () => {
    speech.stop();
    session.stopPendingSpeech();
  };

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
      setBoardMode("model");
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
    const text = speech.lastFinal.transcript.trim();
    const command =
      /^(?:vision[, :]*)?(?:rotate (?:left|right|up|down)|zoom (?:in|out)|next model|previous model|reset (?:view|model)|pause (?:motion|rotation)|resume (?:motion|rotation)|projector mode)[.!?]?$/i.test(
        text,
      );
    if (command && nativeBoard) void handleTeacherCommand(text);
    else session.hear(text);
  }, [handleTeacherCommand, speech.lastFinal, session.hear, nativeBoard]);

  useEffect(() => {
    previousHand.current = null;
  }, [boardMode, activeVisualId, session.activeCard?.id, controlsActive]);
  useEffect(() => {
    const previous = previousHand.current;
    previousHand.current = controlsActive ? hand.gesture : null;
    if (!controlsActive || !nativeBoard) return;
    const motion = gestureMotion(previous, hand.gesture);
    if (!motion.yaw && !motion.pitch && motion.zoomFactor === 1) return;
    setTransform((current) => ({
      ...current,
      paused: true,
      rotationY: current.rotationY + motion.yaw,
      rotationX: Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, current.rotationX + motion.pitch),
      ),
      zoom: Math.max(0.62, Math.min(1.8, current.zoom * motion.zoomFactor)),
    }));
  }, [hand.gesture, controlsActive, nativeBoard]);

  useEffect(() => {
    const event = hand.lastEvent;
    if (!event || event.id === lastGestureIdRef.current) return;
    // Always consume, even on a board that does not support this gesture.
    lastGestureIdRef.current = event.id;
    if (!controlsActive || Date.now() - event.timestamp > 1500) return;
    if (event.name === "thumbs-up") {
      if (session.suggestion && !session.processing) {
        session.showCard(session.suggestion);
        setHandFeedback("Suggestion shown on the board.");
        document
          .getElementById("presentation-board")
          ?.scrollIntoView({ block: "start" });
      } else
        setHandFeedback(
          session.processing
            ? "The next visual is still being prepared."
            : "No suggestion is waiting to be shown.",
        );
      return;
    }
    if (event.name === "fist") {
      if (nativeBoard)
        applyAction("reset", undefined, "Gesture: fist reset", 1);
      else if (boardMode === "external")
        setExternalResetToken((value) => value + 1);
      else if (engineBoard)
        setEngineNavigation({ id: event.id, action: "reset" });
      else return;
      setHandFeedback("View reset.");
      return;
    }
    if (event.name !== "swipe-left" && event.name !== "swipe-right") return;
    const action = event.name === "swipe-right" ? "next" : "previous";
    if (nativeBoard) {
      setBoardMode("model");
      applyAction(action, undefined, "Gesture: " + event.name, 1);
      setHandFeedback(action === "next" ? "Next model." : "Previous model.");
    } else if (engineBoard) {
      setEngineNavigation({ id: event.id, action });
      setHandFeedback(
        action === "next" ? "Next engine stroke." : "Previous engine stroke.",
      );
    } else if (session.cards.length) {
      const index = session.cards.findIndex(
        (card) => card.id === session.activeCard?.id,
      );
      const next = index < 0 ? 0 : index + (action === "next" ? 1 : -1);
      if (next >= 0 && next < session.cards.length) {
        session.showCard(session.cards[next]);
        setBoardMode("concept");
        setHandFeedback("Showing " + session.cards[next].plan.title);
      } else
        setHandFeedback(
          action === "next"
            ? "This is the latest session visual."
            : "This is the first session visual.",
        );
    }
  }, [
    hand.lastEvent,
    controlsActive,
    nativeBoard,
    boardMode,
    engineBoard,
    applyAction,
    session.suggestion,
    session.processing,
    session.cards,
    session.activeCard,
    session.showCard,
  ]);
  useEffect(() => {
    if (!handFeedback) return;
    const timer = window.setTimeout(() => setHandFeedback(""), 4500);
    return () => window.clearTimeout(timer);
  }, [handFeedback]);

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
      if (!nativeBoard) return;
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
  }, [applyAction, transform.paused, helpOpen, nativeBoard]);

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
        Skip to presentation workspace
      </a>
      <LibraryPanel
        activeId={nativeBoard ? activeVisualId : null}
        onSelect={handleSelectVisual}
        onOpenHelp={() => setHelpOpen(true)}
        onHome={() => {
          setBoardMode("welcome");
          setLibraryOpen(false);
        }}
        isCanvas={boardMode !== "model"}
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
          onToggleProjector={() => {
            if (!projectorMode) setHandPanelOpen(false);
            applyAction("projector", undefined, "Button: projector mode", 1);
          }}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          sessionActive={speech.listening || hand.enabled}
          libraryOpen={libraryOpen}
          handEnabled={hand.enabled}
          handLoading={hand.loading}
          onHandControl={() => {
            if (hand.enabled || hand.loading)
              setHandPanelOpen((value) => !value);
            else startHandControl();
          }}
        />
        <main id="main-workspace" className="workspace-content" tabIndex={-1}>
          <div className="workspace-intro">
            <div>
              <div className="workspace-eyebrow">
                <span />
                MADE FOR THE MOMENT
              </div>
              <h1>Presentation studio</h1>
              <p>Make the next idea click.</p>
            </div>
            <div className="session-actions">
              <button
                type="button"
                disabled={!session.cards.length && !session.transcript.length}
                onClick={() => downloadSession(session)}
              >
                <Icon name="download" size={15} />
                Export session
              </button>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  stopHandControl();
                  setHandPanelOpen(false);
                  session.reset();
                  setBoardMode("welcome");
                }}
              >
                New session
                <Icon name="plus" size={15} />
              </button>
            </div>
          </div>
          <SessionBrief
            context={session.context}
            onChange={session.setContext}
            disabled={session.processing}
          />

          <div className="studio-grid">
            <div className="stage-column" id="presentation-board">
              {boardMode === "welcome" && (
                <WelcomeBoard
                  processing={session.processing}
                  onExample={(message) =>
                    void session.ask(message, "ask", "presenter", true)
                  }
                />
              )}
              {boardMode === "external" && externalModel && (
                <ModelViewer
                  model={externalModel}
                  gesture={activeGesture}
                  gestureEnabled={controlsActive}
                  resetToken={externalResetToken}
                  onClose={() =>
                    setBoardMode(session.activeCard ? "concept" : "welcome")
                  }
                />
              )}
              {boardMode === "concept" && session.activeCard && (
                <ConceptBoard
                  card={session.activeCard}
                  engineNavigation={engineNavigation}
                  onDetailedModel={() => showExternal(featuredEngine)}
                  model={
                    <Suspense
                      fallback={
                        <div className="model-loading" role="status">
                          Opening the interactive model...
                        </div>
                      }
                    >
                      <ProjectionStage
                        visual={activeVisual}
                        transform={transform}
                        gesture={activeGesture}
                        projectorMode={projectorMode}
                        onRotate={handleRotate}
                      >
                        <ControlPanel
                          transform={transform}
                          onAction={handleDirectAction}
                        />
                      </ProjectionStage>
                    </Suspense>
                  }
                  onAsk={(message, trigger) =>
                    void session.ask(message, trigger || "ask")
                  }
                />
              )}
              {boardMode === "model" && (
                <>
                  <Suspense
                    fallback={
                      <div className="model-loading" role="status">
                        Opening the interactive model...
                      </div>
                    }
                  >
                    <ProjectionStage
                      visual={activeVisual}
                      transform={transform}
                      gesture={activeGesture}
                      projectorMode={projectorMode}
                      onRotate={handleRotate}
                    >
                      <ControlPanel
                        transform={transform}
                        onAction={handleDirectAction}
                      />
                    </ProjectionStage>
                  </Suspense>
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
                      gesture={activeGesture}
                      lastIntent={lastIntent}
                      onSubmitCommand={handleTeacherCommand}
                      processing={processing}
                    />
                    <CommandHistory history={history} />
                  </div>
                </>
              )}
              {session.cards.length > 0 && (
                <nav className="session-timeline" aria-label="Session visuals">
                  <div>
                    <span>YOUR SESSION</span>
                    <small>
                      {session.cards.length} visual
                      {session.cards.length === 1 ? "" : "s"}
                    </small>
                  </div>
                  <ol>
                    {session.cards.map((card, index) => (
                      <li key={card.id}>
                        <button
                          type="button"
                          aria-current={
                            boardMode === "concept" &&
                            session.activeCard?.id === card.id
                              ? "step"
                              : undefined
                          }
                          onClick={() => {
                            session.showCard(card);
                            setBoardMode("concept");
                          }}
                        >
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{card.plan.title}</strong>
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <div className="external-library">
                <ExternalModels
                  selectedModelId={
                    boardMode === "external" ? externalModel?.uid : null
                  }
                  onModelSelect={showExternal}
                  initialQuery={
                    session.activeCard?.plan.externalQuery || "car engine"
                  }
                />
              </div>
            </div>
            <aside
              className="side-stack"
              aria-label="Presentation tools"
              style={{ display: projectorMode ? "none" : undefined }}
            >
              <CopilotPanel
                session={session}
                speech={{ ...speech, stop: stopListening }}
                onModelSelect={showExternal}
              />
              <section className="hand-access-card">
                <Icon name="hand" size={25} />
                <div>
                  <h3>Step away from the laptop.</h3>
                  <p>
                    Use your hand to rotate and zoom 3D models, or approve a
                    visual with a thumbs-up.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (hand.enabled) setHandPanelOpen(true);
                      else startHandControl();
                    }}
                  >
                    <Icon name="camera" size={14} />
                    {hand.enabled
                      ? "Open hand controls"
                      : "Enable hand control"}
                  </button>
                </div>
              </section>
            </aside>
          </div>
          <button
            className="mobile-copilot-link"
            type="button"
            onClick={() => document.getElementById("copilot-question")?.focus()}
          >
            <Icon name="mic" size={16} />
            Ask or speak to Vision
            <Icon name="arrow-right" size={15} />
          </button>
          <footer className="workspace-footer">
            <span>
              Vision <span className="footer-dot">·</span> A little perspective
              goes a long way.
            </span>
            <span>
              From classrooms to boardrooms
              <Icon name="leaf" size={13} />
            </span>
          </footer>
        </main>
      </div>
      <HandControlDock
        open={handPanelOpen}
        onToggle={() => setHandPanelOpen((value) => !value)}
        armed={gestureArmed}
        onToggleArmed={() => setGestureArmed((value) => !value)}
        target={
          nativeBoard || boardMode === "external"
            ? "model"
            : engineBoard
              ? "engine"
              : "session"
        }
        pendingTitle={session.suggestion?.plan.title}
        processing={session.processing}
        feedback={handFeedback}
        videoRef={hand.videoRef}
        canvasRef={hand.canvasRef}
        enabled={hand.enabled}
        loading={hand.loading}
        error={hand.error}
        gesture={hand.gesture}
        onStart={startHandControl}
        onStop={stopHandControl}
      />
      {controlsActive &&
        hand.gesture.active &&
        hand.gesture.name === "point" && (
          <div
            className="presenter-pointer"
            aria-hidden="true"
            style={{
              left: `clamp(20px, ${(1 - hand.gesture.x) * 100}%, calc(100% - 20px))`,
              top: `clamp(20px, ${hand.gesture.y * 100}%, calc(100% - 20px))`,
            }}
          />
        )}
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
