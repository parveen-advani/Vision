import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SpeechEventPayload {
  id: number;
  transcript: string;
  confidence: number;
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const eventIdRef = useRef(0);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastFinal, setLastFinal] = useState<SpeechEventPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const RecognitionClass = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition;
  }, []);

  useEffect(() => {
    setSupported(Boolean(RecognitionClass));
  }, [RecognitionClass]);

  const createRecognition = useCallback(() => {
    if (!RecognitionClass) return null;

    const recognition = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onerror = (event) => {
      setError(event.error || 'Speech recognition error');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        setListening(false);
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (shouldListenRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Browser may still be closing the previous recognition session.
          }
        }, 450);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      let confidence = 0;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        if (!alternative) continue;

        if (result.isFinal) {
          finalText += alternative.transcript;
          confidence = Math.max(confidence, alternative.confidence || 0.75);
        } else {
          interim += alternative.transcript;
        }
      }

      setInterimTranscript(interim.trim());

      const trimmedFinal = finalText.trim();
      if (trimmedFinal) {
        eventIdRef.current += 1;
        setLastFinal({ id: eventIdRef.current, transcript: trimmedFinal, confidence: confidence || 0.75 });
        setInterimTranscript('');
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [RecognitionClass]);

  const start = useCallback(() => {
    setError(null);
    if (!RecognitionClass) {
      setSupported(false);
      setError('Speech recognition is not available in this browser. Use the manual command box.');
      return;
    }

    shouldListenRef.current = true;
    const recognition = recognitionRef.current ?? createRecognition();
    if (!recognition) return;

    try {
      recognition.start();
    } catch {
      // Ignore repeated start calls.
    }
  }, [RecognitionClass, createRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    setListening(false);
    setInterimTranscript('');
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors from already-stopped recognizers.
    }
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        // Component unmount cleanup.
      }
    };
  }, []);

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
