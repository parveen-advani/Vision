import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import type { PresentationController } from "./usePresentation";
import type { ExternalModel, SessionTurn } from "./types";
import { featuredEngine } from "./ExternalModels";

interface SpeechControl {
  supported: boolean;
  listening: boolean;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}
export function CopilotPanel({
  session,
  speech,
  onModelSelect,
}: {
  session: PresentationController;
  speech: SpeechControl;
  onModelSelect: (model: ExternalModel) => void;
}) {
  const [input, setInput] = useState("");
  const [role, setRole] = useState<SessionTurn["role"]>("audience");
  const [relatedModel, setRelatedModel] = useState<ExternalModel | null>(null);
  const relatedCard = session.suggestion || session.activeCard;
  useEffect(() => {
    setRelatedModel(null);
    if (!relatedCard?.plan.externalQuery) return;
    if (relatedCard.plan.kind === "engine") {
      setRelatedModel(featuredEngine);
      return;
    }
    const controller = new AbortController();
    fetch(
      "/api/models?q=" +
        encodeURIComponent(relatedCard.plan.externalQuery.slice(0, 100)),
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        const model = data?.models?.[0] as ExternalModel | undefined;
        if (model && /^[a-f0-9]{32}$/i.test(model.uid)) setRelatedModel(model);
      })
      .catch(() => {
        /* The explanation remains usable if the catalog is unavailable. */
      });
    return () => controller.abort();
  }, [relatedCard?.id]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() || session.processing) return;
    void session.ask(input, "ask", role);
    setInput("");
  };
  return (
    <section className="copilot-panel" aria-labelledby="copilot-title">
      <div className="copilot-heading">
        <span className="copilot-symbol">
          <Icon name="layers" size={18} />
        </span>
        <div>
          <h2 id="copilot-title">Presentation copilot</h2>
          <p>A little help, at the right moment.</p>
        </div>
      </div>
      <div
        className={
          "copilot-connection " + (session.aiConfigured ? "connected" : "")
        }
      >
        <span />
        {session.aiConfigured === null
          ? "Checking connection…"
          : session.aiConfigured
            ? "Contextual AI enabled"
            : "Guide mode · AI not connected"}
      </div>
      {!session.aiConfigured && session.aiConfigured !== null && (
        <p className="copilot-guide-notice">
          Try the prepared examples and model library. Open-ended explanations
          need an AI connection.
        </p>
      )}
      <div className="copilot-mode">
        <label htmlFor="auto-show">
          Show visuals automatically
          <small>
            {session.autoShow
              ? "The board updates as you speak."
              : "Review each suggestion before showing it."}
          </small>
        </label>
        <input
          id="auto-show"
          type="checkbox"
          role="switch"
          checked={session.autoShow}
          onChange={(e) => session.setAutoShow(e.target.checked)}
        />
      </div>
      <button
        type="button"
        className={"copilot-listen " + (speech.listening ? "is-listening" : "")}
        disabled={!speech.supported && !speech.listening}
        onClick={speech.listening ? speech.stop : speech.start}
        aria-pressed={speech.listening}
      >
        <Icon name={speech.listening ? "mic-off" : "mic"} size={18} />
        <span>
          {speech.listening ? "Stop listening" : "Listen to the presentation"}
        </span>
        {speech.listening && (
          <span className="listening-bars">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      {!speech.supported && (
        <p className="copilot-help">
          Voice is unavailable in this browser. You can type below.
        </p>
      )}
      {speech.error && (
        <p className="copilot-error" role="alert">
          {speech.error === "not-allowed"
            ? "Microphone access was blocked. Allow it in your browser or type below."
            : "Voice recognition stopped: " +
              speech.error +
              ". You can type below."}
        </p>
      )}
      {speech.listening && (
        <div className="live-caption" aria-live="polite">
          <span>LIVE TRANSCRIPT</span>
          <p>
            {speech.interimTranscript ||
              session.transcript.filter((t) => t.role === "presenter").at(-1)
                ?.text ||
              "Speak naturally. Vision will use the recent conversation as context."}
          </p>
        </div>
      )}
      <form onSubmit={submit} className="copilot-form">
        <div className="question-role" role="group" aria-label="Question from">
          <button
            type="button"
            aria-pressed={role === "audience"}
            onClick={() => setRole("audience")}
          >
            Audience question
          </button>
          <button
            type="button"
            aria-pressed={role === "presenter"}
            onClick={() => setRole("presenter")}
          >
            Presenter prompt
          </button>
        </div>
        <label htmlFor="copilot-question" className="sr-only">
          Ask the presentation copilot
        </label>
        <textarea
          id="copilot-question"
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            role === "audience"
              ? "“Could you explain what that means?”"
              : "Explain a concept, compare ideas, or ask for a visual…"
          }
          rows={3}
        />
        <div className="copilot-compose-footer">
          <label className="research-toggle">
            <input
              type="checkbox"
              checked={session.webResearch}
              disabled={!session.aiConfigured}
              onChange={(e) => session.setWebResearch(e.target.checked)}
            />
            <Icon name="globe" size={14} />
            Web sources
          </label>
          <button
            type="submit"
            className="copilot-send"
            disabled={!input.trim() || session.processing}
            aria-label="Ask copilot"
          >
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </form>
      <button
        className="explain-this"
        type="button"
        disabled={
          session.processing ||
          (!session.transcript.length && !session.activeCard)
        }
        onClick={() =>
          void session.ask(
            "Explain the most recent concept in this conversation more simply.",
            "simplify",
          )
        }
      >
        <Icon name="info" size={15} />
        Explain this moment
      </button>
      {session.processing && (
        <div className="copilot-working" role="status">
          <span className="working-dot" />
          <span>Preparing your visual…</span>
          <button type="button" onClick={session.cancel}>
            Cancel
          </button>
        </div>
      )}
      {session.suggestion && (
        <article className="copilot-suggestion" aria-label="Suggested visual">
          <div className="suggestion-label">
            <Icon name="layers" size={14} />
            <span>
              {session.suggestion.source === "ai"
                ? "SUGGESTED FOR THIS MOMENT"
                : "PREPARED GUIDE"}
            </span>
          </div>
          <h3>{session.suggestion.plan.title}</h3>
          <p>{session.suggestion.plan.takeaway}</p>
          <div className="suggestion-actions">
            <button
              type="button"
              onClick={() => {
                session.showCard(session.suggestion!);
                document
                  .getElementById("presentation-board")
                  ?.scrollIntoView({ block: "start" });
              }}
            >
              Show on board
              <Icon name="arrow-right" size={14} />
            </button>
            <button
              type="button"
              onClick={session.dismiss}
              aria-label="Dismiss suggestion"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </article>
      )}
      {session.status && !session.processing && (
        <p className="copilot-status" role="status">
          {session.status}
        </p>
      )}
      {relatedModel && (
        <div className="copilot-related-model">
          <span>ANOTHER WAY TO EXPLAIN IT</span>
          <button type="button" onClick={() => onModelSelect(relatedModel)}>
            {relatedModel.thumbnail && (
              <img src={relatedModel.thumbnail} alt="" loading="lazy" />
            )}
            <span>
              <strong>{relatedModel.title}</strong>
              <small>3D by {relatedModel.author}</small>
            </span>
            <Icon name="arrow-up-right" size={15} />
          </button>
          <p>Preview this related model on the board.</p>
        </div>
      )}
      <details className="transcript-history">
        <summary>
          Conversation<span>{session.transcript.length}</span>
          <Icon name="chevron-down" size={14} />
        </summary>
        {session.transcript.length ? (
          <ol>
            {session.transcript.slice(-12).map((turn) => (
              <li key={turn.id}>
                <span>
                  {turn.role === "presenter" ? "Presenter" : "Audience"}
                </span>
                <p>{turn.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            Your spoken and typed questions will appear here during this
            session.
          </p>
        )}
      </details>
      <p className="copilot-privacy">
        <Icon name="info" size={13} />
        Your browser transcribes speech. Recent text and session notes are sent
        to AI when connected. The session stays in this tab until you export it.
      </p>
    </section>
  );
}
