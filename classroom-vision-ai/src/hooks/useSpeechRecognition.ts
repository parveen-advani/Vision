import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SpeechEventPayload {
  id: number;
  transcript: string;
  confidence: number;
}

export function useSpeechRecognition(language: "en-IN" | "hi-IN" = "en-IN") {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const eventIdRef = useRef(0);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastFinal, setLastFinal] = useState<SpeechEventPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const RecognitionClass = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition;
  }, []);

  const clearRestart = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const releaseRecognition = useCallback(() => {
    clearRestart();
    startingRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.abort();
    } catch {
      // A recognizer that never started may already be closed.
    }
  }, [clearRestart]);

  const createRecognition = useCallback(() => {
    if (!RecognitionClass) return null;

    const recognition = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    const current = () =>
      mountedRef.current && recognitionRef.current === recognition;

    recognition.onstart = () => {
      if (!current()) return;
      startingRef.current = false;
      if (!shouldListenRef.current) {
        releaseRecognition();
        return;
      }
      setListening(true);
      setError(null);
    };

    recognition.onerror = (event) => {
      if (!current() || !shouldListenRef.current) return;
      setError(event.error || "Speech recognition error");
      if (
        [
          "not-allowed",
          "service-not-allowed",
          "audio-capture",
          "language-not-supported",
        ].includes(event.error)
      ) {
        shouldListenRef.current = false;
        setListening(false);
        setInterimTranscript("");
        releaseRecognition();
      }
    };

    recognition.onend = () => {
      if (!current()) return;
      startingRef.current = false;
      // Keep the Stop control available while a listening session reconnects.
      setListening(shouldListenRef.current);
      setInterimTranscript("");
      clearRestart();
      if (!shouldListenRef.current) return;
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!current() || !shouldListenRef.current) return;
        try {
          startingRef.current = true;
          recognition.start();
        } catch {
          startingRef.current = false;
          shouldListenRef.current = false;
          setListening(false);
          setError(
            "Listening could not restart. Select Start listening to try again.",
          );
        }
      }, 450);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!current() || !shouldListenRef.current) return;
      const interim: string[] = [];
      const finals: string[] = [];
      let confidence = 0;

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const alternative = result[0];
        if (!alternative) continue;
        if (result.isFinal) {
          finals.push(alternative.transcript.trim());
          confidence = Math.max(confidence, alternative.confidence || 0.75);
        } else {
          interim.push(alternative.transcript.trim());
        }
      }

      setInterimTranscript(interim.filter(Boolean).join(" "));
      const transcript = finals.filter(Boolean).join(" ");
      if (transcript) {
        eventIdRef.current += 1;
        setLastFinal({
          id: eventIdRef.current,
          transcript,
          confidence: confidence || 0.75,
        });
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [RecognitionClass, language, clearRestart, releaseRecognition]);

  const start = useCallback(() => {
    if (!mountedRef.current || startingRef.current || shouldListenRef.current)
      return;
    setError(null);
    if (!RecognitionClass) {
      setSupported(false);
      setError(
        "Speech recognition is not available in this browser. You can type instead.",
      );
      return;
    }

    clearRestart();
    shouldListenRef.current = true;
    const recognition = recognitionRef.current ?? createRecognition();
    if (!recognition) {
      shouldListenRef.current = false;
      return;
    }

    try {
      startingRef.current = true;
      recognition.start();
    } catch {
      shouldListenRef.current = false;
      releaseRecognition();
      setListening(false);
      setError(
        "The microphone could not start. Try again, or type your question.",
      );
    }
  }, [RecognitionClass, createRecognition, clearRestart, releaseRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    releaseRecognition();
    setListening(false);
    setInterimTranscript("");
  }, [releaseRecognition]);

  useEffect(() => {
    mountedRef.current = true;
    shouldListenRef.current = false;
    setSupported(Boolean(RecognitionClass));
    setListening(false);
    setInterimTranscript("");
    setError(null);
    return () => {
      mountedRef.current = false;
      shouldListenRef.current = false;
      releaseRecognition();
    };
  }, [RecognitionClass, language, releaseRecognition]);

  return {
    supported,
    listening,
    interimTranscript,
    lastFinal,
    error,
    start,
    stop,
  };
}
