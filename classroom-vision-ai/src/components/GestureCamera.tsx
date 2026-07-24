import type { GestureState } from '../types';

type GestureCameraProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  enabled: boolean;
  loading: boolean;
  error: string | null;
  gesture: GestureState;
  onStart: () => void;
  onStop: () => void;
};

export function GestureCamera({
  videoRef,
  canvasRef,
  enabled,
  loading,
  error,
  gesture,
  onStart,
  onStop,
}: GestureCameraProps) {
  return (
    <article className="panel camera-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Computer vision</p>
          <h3>Hand gesture camera</h3>
        </div>
        <span className={`status-dot ${enabled ? 'status-dot--live' : ''}`} />
      </div>

      <div className="camera-frame">
        <video ref={videoRef} className="camera-video" muted playsInline />
        <canvas ref={canvasRef} className="camera-canvas" />
        {!enabled && <div className="camera-placeholder">Camera preview appears here after permission</div>}
      </div>

      <div className="gesture-readout">
        <div>
          <span>Current gesture</span>
          <strong>{gesture.name.replace('-', ' ')}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{Math.round(gesture.confidence * 100)}%</strong>
        </div>
      </div>

      <p className="gesture-message">{gesture.message}</p>

      <div className="button-row">
        <button className="primary-button" type="button" onClick={enabled ? onStop : onStart} disabled={loading}>
          {loading ? 'Starting Camera...' : enabled ? 'Stop Camera' : 'Start Camera'}
        </button>
        <button className="ghost-button" type="button" onClick={onStop} disabled={!enabled}>
          Reset Feed
        </button>
      </div>

      {error && <p className="notice notice--error">{error}</p>}

      <div className="gesture-cheatsheet">
        <span>Open palm = rotate</span>
        <span>Pinch = zoom</span>
        <span>Point = spotlight</span>
        <span>Fist = reset</span>
        <span>Swipe = next/previous</span>
      </div>
    </article>
  );
}
