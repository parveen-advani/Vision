import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultSessionContext,
  type CopilotRequest,
  type CopilotResponse,
  type SessionCard,
  type SessionContext,
  type SessionTurn,
} from "./types";
import { makeGuideResponse } from "./guides";
import { validatePlan } from "./validate";

const uid = () => crypto.randomUUID();
export function usePresentation() {
  const [context, setContext] = useState<SessionContext>(defaultSessionContext);
  const [transcript, setTranscript] = useState<SessionTurn[]>([]);
  const [cards, setCards] = useState<SessionCard[]>([]);
  const [activeCard, setActiveCard] = useState<SessionCard | null>(null);
  const [suggestion, setSuggestion] = useState<SessionCard | null>(null);
  const [processing, setProcessing] = useState(false);
  const [autoShow, setAutoShow] = useState(false);
  const [webResearch, setWebResearch] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const [boardContext, setBoardContext] =
    useState<CopilotRequest["currentPlan"]>(null);
  const processingRef = useRef(false);
  const activeTrigger = useRef<CopilotRequest["trigger"] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout>>();
  const speechBuffer = useRef("");
  const lastSpeechRequest = useRef(0);
  const current = useRef({
    context,
    transcript,
    activeCard,
    autoShow,
    webResearch,
    boardContext,
  });
  current.current = {
    context,
    transcript,
    activeCard,
    autoShow,
    webResearch,
    boardContext,
  };

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/assistant", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.aiConfigured === "boolean")
          setAiConfigured(data.aiConfigured);
      })
      .catch(() => setAiConfigured(false));
    return () => {
      abort.abort();
      abortRef.current?.abort();
      clearTimeout(speechTimer.current);
    };
  }, []);

  const showCard = useCallback((card: SessionCard) => {
    setActiveCard(card);
    setSuggestion(null);
    setCards((items) =>
      items.some((item) => item.id === card.id)
        ? items
        : [...items, card].slice(-100),
    );
  }, []);

  const appendTurn = useCallback((text: string, role: SessionTurn["role"]) => {
    const turn: SessionTurn = {
      id: uid(),
      text: text.slice(0, 4000),
      role,
      at: new Date().toISOString(),
    };
    const next = [...current.current.transcript, turn].slice(-400);
    current.current.transcript = next;
    setTranscript(next);
    return next;
  }, []);

  const ask = useCallback(
    async (
      message: string,
      trigger: CopilotRequest["trigger"] = "ask",
      role: SessionTurn["role"] = "audience",
      showNow = false,
      record = true,
    ) => {
      const clean = message.trim().slice(0, 4000);
      if (!clean) return;
      clearTimeout(speechTimer.current);
      speechBuffer.current = "";
      abortRef.current?.abort();
      const seq = ++sequenceRef.current;
      const abort = new AbortController();
      abortRef.current = abort;
      activeTrigger.current = trigger;
      const turns = record
        ? appendTurn(clean, role)
        : current.current.transcript;
      const state = current.current;
      const request: CopilotRequest = {
        message: clean,
        trigger,
        context: state.context,
        transcript: turns
          .slice(-12)
          .map((turn) => ({ ...turn, text: turn.text.slice(0, 1500) })),
        currentPlan: state.boardContext,
        webResearch: state.webResearch,
      };
      processingRef.current = true;
      setProcessing(true);
      setStatus("Preparing an explanation for your audience…");
      const timeout = setTimeout(() => abort.abort(), 50000);
      try {
        let response: CopilotResponse;
        try {
          const result = await fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
            signal: abort.signal,
          });
          if (!result.ok)
            throw new Error(
              result.status === 429
                ? "The assistant is busy. Wait a moment and try again."
                : "The assistant could not connect.",
            );
          const data = await result.json();
          const plan = validatePlan(data.plan);
          if (!plan || !["ai", "guide"].includes(data.source))
            throw new Error("The assistant returned an incomplete visual.");
          response = { ...data, plan };
        } catch (error) {
          if (seq !== sequenceRef.current) return;
          const notice = abort.signal.aborted
            ? "The AI request took too long. Showing an available guide."
            : error instanceof Error
              ? error.message
              : "The assistant could not connect.";
          response = makeGuideResponse(request, notice);
        }
        if (seq !== sequenceRef.current) return;
        setAiConfigured(response.aiConfigured);
        const card: SessionCard = {
          ...response,
          id: uid(),
          question: clean,
          createdAt: new Date().toISOString(),
        };
        if (showNow || current.current.autoShow) showCard(card);
        else setSuggestion(card);
        setStatus(
          response.notice ||
            (response.source === "ai"
              ? "Your visual is ready."
              : "Prepared guide ready."),
        );
      } finally {
        clearTimeout(timeout);
        if (seq === sequenceRef.current) {
          activeTrigger.current = null;
          processingRef.current = false;
          setProcessing(false);
        }
      }
    },
    [appendTurn, showCard],
  );

  const hear = useCallback(
    (text: string) => {
      appendTurn(text, "presenter");
      speechBuffer.current = (speechBuffer.current + " " + text)
        .trim()
        .slice(-4000);
      clearTimeout(speechTimer.current);
      // Wait for a thought to finish, with at most one request every twelve seconds.
      const wait = Math.max(
        1800,
        12000 - (Date.now() - lastSpeechRequest.current),
      );
      const processSpeech = () => {
        if (processingRef.current) {
          speechTimer.current = setTimeout(processSpeech, 1500);
          return;
        }
        const buffered = speechBuffer.current;
        if (buffered.length < 20) return;
        lastSpeechRequest.current = Date.now();
        void ask(buffered, "speech", "presenter", false, false);
      };
      speechTimer.current = setTimeout(processSpeech, wait);
    },
    [appendTurn, ask],
  );

  const stopPendingSpeech = useCallback(() => {
    clearTimeout(speechTimer.current);
    speechBuffer.current = "";
    if (activeTrigger.current === "speech") {
      abortRef.current?.abort();
      sequenceRef.current++;
      activeTrigger.current = null;
      processingRef.current = false;
      setProcessing(false);
      setStatus("Listening stopped. Your current board stays in place.");
    }
  }, []);
  useEffect(() => {
    stopPendingSpeech();
  }, [context.language, stopPendingSpeech]);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    sequenceRef.current++;
    stopPendingSpeech();
    processingRef.current = false;
    setProcessing(false);
    setContext(defaultSessionContext);
    setBoardContext(null);
    setAutoShow(false);
    setWebResearch(false);
    setTranscript([]);
    setCards([]);
    setActiveCard(null);
    setSuggestion(null);
    setStatus("");
    current.current.transcript = [];
    lastSpeechRequest.current = 0;
    activeTrigger.current = null;
  }, [stopPendingSpeech]);
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    sequenceRef.current++;
    activeTrigger.current = null;
    processingRef.current = false;
    setProcessing(false);
    setStatus("Request cancelled.");
  }, []);

  return {
    context,
    setContext,
    transcript,
    cards,
    activeCard,
    setActiveCard,
    setBoardContext,
    suggestion,
    dismiss: () => setSuggestion(null),
    processing,
    autoShow,
    setAutoShow,
    webResearch,
    setWebResearch,
    aiConfigured,
    status,
    ask,
    hear,
    showCard,
    reset,
    cancel,
    stopPendingSpeech,
  };
}

export type PresentationController = ReturnType<typeof usePresentation>;

export function downloadSession(
  session: Pick<PresentationController, "context" | "cards" | "transcript">,
) {
  const lines = [
    `# ${session.context.topic || "Vision session"}`,
    "",
    `Audience: ${session.context.audience}`,
    "",
  ];
  for (const card of session.cards) {
    const p = card.plan;
    lines.push(
      `## ${p.title}`,
      "",
      p.takeaway,
      "",
      p.explanation,
      "",
      ...p.keyPoints.map((t) => `- ${t}`),
      "",
      ...p.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.detail}`),
      ...p.comparison.flatMap((c) => [
        `### ${c.heading}`,
        ...c.points.map((t) => `- ${t}`),
      ]),
      ...p.metrics.map((m) => `- ${m.label}: ${m.value} ${m.unit}`),
      "",
      p.analogy ? `Analogy: ${p.analogy}` : "",
      p.caveat,
      `Source: ${card.source === "ai" ? "AI-generated explanation" : "Prepared guide"}`,
      ...p.citations.map((c) => `${c.title}: ${c.url}`),
      "",
    );
  }
  lines.push(
    "## Conversation",
    "",
    ...session.transcript.map(
      (t) => `${t.role === "presenter" ? "Presenter" : "Audience"}: ${t.text}`,
    ),
  );
  const url = URL.createObjectURL(
    new Blob([lines.filter((line) => line !== undefined).join("\n")], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "vision-session.md";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
