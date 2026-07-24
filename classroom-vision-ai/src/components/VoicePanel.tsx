import { FormEvent, useState } from 'react';

type VoicePanelProps = {
  supported: boolean;
  listening: boolean;
  interimTranscript: string;
  speechError: string | null;
  onStart: () => void;
  onStop: () => void;
  onSubmitCommand: (command: string) => void;
};

export function VoicePanel({
  supported,
  listening,
  interimTranscript,
  speechError,
  onStart,
  onStop,
  onSubmitCommand,
}: VoicePanelProps) {
  const [manualCommand, setManualCommand] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const command = manualCommand.trim();
    if (!command) return;
    onSubmitCommand(command);
    setManualCommand('');
  };

  return (
    <article className="panel voice-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Voice AI</p>
          <h3>Teacher microphone</h3>
        </div>
        <span className={`status-dot ${listening ? 'status-dot--live' : ''}`} />
      </div>

      <div className="meter" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} style={{ animationDelay: `${index * 45}ms` }} className={listening ? 'meter-bar live' : 'meter-bar'} />
        ))}
      </div>

      <div className="button-row">
        <button className="primary-button" type="button" onClick={listening ? onStop : onStart}>
          {listening ? 'Stop Listening' : 'Start Listening'}
        </button>
        <button className="ghost-button" type="button" onClick={() => onSubmitCommand('show human heart')}>
          Demo Command
        </button>
      </div>

      <div className="transcript-box">
        <span>{listening ? 'Live transcript' : 'Transcript standby'}</span>
        <p>{interimTranscript || 'Say: “Show OSI model”, “Zoom in”, “Explode the heart model”, or use the manual command below.'}</p>
      </div>

      {!supported && <p className="notice">Browser speech recognition is unavailable here. The manual command box still works.</p>}
      {speechError && <p className="notice notice--error">{speechError}</p>}

      <form className="manual-command" onSubmit={submit}>
        <input
          value={manualCommand}
          onChange={(event) => setManualCommand(event.target.value)}
          placeholder="Type a teacher command, e.g. show DNA double helix"
          aria-label="Manual command"
        />
        <button type="submit">Send</button>
      </form>
    </article>
  );
}
