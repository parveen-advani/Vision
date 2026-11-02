import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./Icon";

type VoicePanelProps = {
  supported: boolean;
  listening: boolean;
  interimTranscript: string;
  speechError: string | null;
  processing?: boolean;
  onStart: () => void;
  onStop: () => void;
  onSubmitCommand: (command: string) => void;
};

const speechErrorMessages: Record<string, string> = {
  "not-allowed":
    "Microphone access is blocked. Allow it in your browser settings, then try again.",
  "service-not-allowed":
    "Voice recognition is unavailable in this browser. You can type a command below.",
  "audio-capture":
    "No microphone was found. Connect one, or type a command below.",
  network:
    "Voice recognition could not connect. Try again, or type a command below.",
  "no-speech": "No speech was detected. Try speaking again.",
  aborted: "Listening stopped. Start again whenever you are ready.",
};

export function VoicePanel({
  supported,
  listening,
  interimTranscript,
  speechError,
  processing = false,
  onStart,
  onStop,
  onSubmitCommand,
}: VoicePanelProps) {
  const [manualCommand, setManualCommand] = useState("");
  const commandInputId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const command = manualCommand.trim();
    if (!command || processing) return;
    onSubmitCommand(command);
    setManualCommand("");
  };

  return (
    <section
      className="tool-card voice-panel"
      aria-labelledby={commandInputId + "-heading"}
    >
      <div className="tool-card-heading">
        <h3 id={commandInputId + "-heading"}>
          <Icon name="mic" size={17} />
          Voice commands
        </h3>
        <span className={"tool-status" + (listening ? " is-active" : "")}>
          {listening ? "Listening" : supported ? "Ready" : "Unavailable"}
        </span>
      </div>

      <p className="tool-description">
        Change the model or adjust the view with your voice.
      </p>
      <button
        className={"tool-primary-button" + (listening ? " is-active" : "")}
        type="button"
        onClick={listening ? onStop : onStart}
        disabled={!supported && !listening}
        aria-pressed={listening}
      >
        <Icon name={listening ? "mic-off" : "mic"} size={17} />
        {listening ? "Stop listening" : "Start listening"}
      </button>

      {(listening || interimTranscript) && (
        <div
          className="voice-transcript"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            {interimTranscript ? "Hearing you" : "Listening for a command"}
          </span>
          <p>{interimTranscript || "Try saying “show the solar system”."}</p>
        </div>
      )}
      {!supported && (
        <p className="tool-notice">
          Voice recognition is unavailable here. Type a command to continue.
        </p>
      )}
      {speechError && (
        <p className="tool-notice tool-notice--error" role="alert">
          {speechErrorMessages[speechError] ?? speechError}
        </p>
      )}

      <form
        className="manual-command-form"
        onSubmit={submit}
        aria-busy={processing}
      >
        <label className="manual-command-label" htmlFor={commandInputId}>
          Or type a command
        </label>
        <div className="manual-command">
          <input
            id={commandInputId}
            value={manualCommand}
            onChange={(event) => setManualCommand(event.target.value)}
            placeholder="Show the solar system"
            aria-label="Manual command"
            autoComplete="off"
            list="sample-commands"
          />
          <button
            type="submit"
            disabled={!manualCommand.trim() || processing}
            aria-label={processing ? "Sending command" : "Send command"}
            title="Send command"
          >
            <Icon name={processing ? "clock" : "send"} size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}
