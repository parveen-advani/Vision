import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GestureState } from "../types";
import type { ExternalModel } from "./types";
import { nativeCatalog, type NativeCatalogEntry } from "./nativeCatalog";
import { Icon } from "../components/Icon";
import { useSketchfabHandControls } from "./useSketchfabHandControls";
import {
  useModelViewerControls,
  type ModelViewerControlApi,
} from "./useModelViewerControls";
import "./external-models.css";

export const featuredEngine: ExternalModel = {
  uid: "e14ebe68273d49a3becda6802270b4b0",
  title: "Rigged 4-Cylinder Engine",
  author: "david.gnzlv",
  authorUrl: "https://sketchfab.com/david.gnzlv",
  url: "https://sketchfab.com/3d-models/rigged-4-cylinder-engine-free-e14ebe68273d49a3becda6802270b4b0",
  thumbnail:
    "https://media.sketchfab.com/models/e14ebe68273d49a3becda6802270b4b0/thumbnails/3a8fd06c44a14e2381b0b06cbb036b2f/70ce914819764b018956875d80fa9044.jpeg",
  license: "CC BY 4.0",
  animated: true,
};

interface ViewerApi extends ModelViewerControlApi {
  start: () => void;
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener?: (event: string, callback: () => void) => void;
}
interface ViewerClient {
  init: (
    uid: string,
    options: {
      autostart: number;
      dnt: number;
      camera: number;
      animation_autoplay: number;
      annotations_visible: number;
      annotation_tooltip_visible: number;
      ui_stop: number;
      ui_infos: number;
      ui_controls: number;
      ui_hint: number;
      success: (api: ViewerApi) => void;
      error: () => void;
    },
  ) => void;
}
declare global {
  interface Window {
    Sketchfab?: new (version: string, frame: HTMLIFrameElement) => ViewerClient;
  }
}
let viewerScript: Promise<void> | null = null;
function loadViewer() {
  if (window.Sketchfab) return Promise.resolve();
  if (viewerScript) return viewerScript;
  viewerScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      viewerScript = null;
      reject(new Error("Viewer could not load."));
    };
    document.head.appendChild(script);
  });
  return viewerScript;
}

export function ModelViewer({
  model,
  onClose,
  gesture,
  gestureEnabled = false,
  resetToken = 0,
}: {
  model: ExternalModel;
  onClose: () => void;
  gesture?: GestureState;
  gestureEnabled?: boolean;
  resetToken?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [viewer, setViewer] = useState<{
    uid: string;
    retry: number;
    api: ViewerApi;
  } | null>(null);
  const cameraApi =
    viewer?.uid === model.uid && viewer.retry === retry ? viewer.api : null;
  const handControls = useSketchfabHandControls(
    cameraApi,
    frame,
    gesture,
    gestureEnabled,
    resetToken,
  );
  const rebaseCamera = handControls.rebaseCamera;
  const controls = useModelViewerControls(
    cameraApi,
    frame,
    model.uid,
    rebaseCamera,
  );
  useEffect(() => {
    let active = true;
    let api: ViewerApi | undefined;
    let ready = false;
    let resizeTimer: number | undefined;
    let previousSize = "";
    let previousAspect = 0;
    const refit = () => {
      if (!active || !ready || !api || !frame.current) return;
      const { width, height } = frame.current.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const aspect = width / height;
      if (!previousAspect) {
        previousAspect = aspect;
        return;
      }
      const distanceScale = previousAspect / aspect;
      previousAspect = aspect;
      if (Math.abs(distanceScale - 1) < 0.03) return;
      const viewer = api;
      try {
        viewer.getCameraLookAt?.((error, camera) => {
          if (
            !active ||
            error ||
            !camera ||
            !Array.isArray(camera.position) ||
            !Array.isArray(camera.target) ||
            camera.position.length !== 3 ||
            camera.target.length !== 3 ||
            ![...camera.position, ...camera.target].every(Number.isFinite)
          )
            return;
          // Preserve the framing horizontally when presentation mode makes the iframe taller.
          const position = camera.position.map(
            (value, index) =>
              camera.target[index] +
              (value - camera.target[index]) * distanceScale,
          );
          try {
            rebaseCamera({ position, target: camera.target });
            viewer.setEnableCameraConstraints?.(false);
            viewer.setCameraLookAt?.(position, camera.target, 0.25);
          } catch {
            // Native viewer controls remain usable if camera methods are unavailable.
          }
        });
      } catch {
        // Resizing must not interrupt the model if its camera API is unavailable.
      }
    };
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const size = `${Math.round(width)}:${Math.round(height)}`;
      if (size === previousSize) return;
      previousSize = size;
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refit, 160);
    });
    if (frame.current) observer.observe(frame.current);
    setState("loading");
    setViewer(null);
    const timeout = window.setTimeout(() => {
      if (active) setState("error");
    }, 25000);
    const onReady = () => {
      if (active) {
        ready = true;
        clearTimeout(timeout);
        setState("ready");
        setViewer(api ? { uid: model.uid, retry, api } : null);
        refit();
      }
    };
    loadViewer()
      .then(() => {
        if (!active || !frame.current || !window.Sketchfab) return;
        const client = new window.Sketchfab("1.12.1", frame.current);
        client.init(model.uid, {
          autostart: 1,
          dnt: 1,
          camera: 0,
          animation_autoplay: 0,
          annotations_visible: 0,
          annotation_tooltip_visible: 0,
          ui_stop: 0,
          // These documented options are honored only for eligible models.
          // Provider branding is retained; the iframe is never cropped or masked.
          ui_infos: 0,
          ui_controls: 0,
          ui_hint: 0,
          success(viewer) {
            if (!active) return;
            api = viewer;
            viewer.addEventListener("viewerready", onReady);
            viewer.start();
          },
          error() {
            if (active) {
              clearTimeout(timeout);
              setState("error");
            }
          },
        });
      })
      .catch(() => {
        if (active) {
          clearTimeout(timeout);
          setState("error");
        }
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      clearTimeout(resizeTimer);
      observer.disconnect();
      api?.removeEventListener?.("viewerready", onReady);
    };
  }, [model.uid, retry, rebaseCamera]);
  return (
    <div
      className="external-viewer"
      data-viewer-state={state}
      data-hand-controls={handControls.status}
    >
      <div className="external-viewer-title">
        <div>
          <span>VISION / 3D STUDIO</span>
          <h4>{model.title}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detailed model"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="external-frame-shell">
        <iframe
          key={`${model.uid}-${retry}`}
          ref={frame}
          title={`${model.title} — interactive Sketchfab viewer`}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
        />
        {state === "loading" && (
          <div className="external-viewer-loading" role="status">
            <span className="external-loading-ring" />
            <strong>Opening the 3D model</strong>
            <span>Detailed geometry can take a moment to load.</span>
          </div>
        )}
        {state === "error" && (
          <div className="external-viewer-error" role="status">
            <strong>The 3D viewer couldn’t load here.</strong>
            <p>
              Your teaching board still works. Try again or open the model
              directly.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry viewer
              </button>
              <a href={model.url} target="_blank" rel="noreferrer">
                Open on Sketchfab ↗
              </a>
            </div>
          </div>
        )}
      </div>
      <div className="model-toolbar" role="group" aria-label="Model controls">
        <div
          className="model-camera-actions"
          role="group"
          aria-label="Camera controls"
        >
          {(
            [
              ["rotate-left", "Rotate model left", controls.camera.rotateLeft],
              [
                "rotate-right",
                "Rotate model right",
                controls.camera.rotateRight,
              ],
              ["minus", "Zoom model out", controls.camera.zoomOut],
              ["plus", "Zoom model in", controls.camera.zoomIn],
              ["reset", "Reset model view", controls.camera.reset],
            ] as const
          ).map(([icon, label, action]) => (
            <button
              key={icon}
              type="button"
              aria-label={label}
              title={label}
              disabled={
                !controls.camera.available ||
                controls.camera.busy ||
                state !== "ready"
              }
              onClick={action}
            >
              <Icon name={icon} size={17} />
            </button>
          ))}
        </div>
        <div className="model-display-actions">
          {controls.animation.available && (
            <button
              type="button"
              onClick={controls.animation.togglePlayback}
              disabled={controls.animation.busy}
              aria-pressed={controls.animation.playing}
              aria-label={
                controls.animation.playing
                  ? "Pause model animation"
                  : "Play model animation"
              }
            >
              <Icon
                name={controls.animation.playing ? "pause" : "play"}
                size={15}
              />
              <span>{controls.animation.playing ? "Pause" : "Animate"}</span>
            </button>
          )}
        </div>
        <details className="model-credits" key={model.uid}>
          <summary>
            <Icon name="info" size={15} />
            <span>Model details</span>
            <Icon name="chevron-down" size={13} />
          </summary>
          <div className="external-attribution">
            <span className="model-credit-label">MODEL & CREATOR</span>
            <span>
              <a href={model.url} target="_blank" rel="noreferrer">
                {model.title}
              </a>{" "}
              by{" "}
              <a href={model.authorUrl} target="_blank" rel="noreferrer">
                {model.author}
              </a>{" "}
              ·{" "}
              {model.uid === featuredEngine.uid ? (
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {model.license}
                </a>
              ) : (
                <span>{model.license}</span>
              )}
            </span>
            <a href="https://sketchfab.com" target="_blank" rel="noreferrer">
              Viewer provided by Sketchfab ↗
            </a>
            <p className="external-controls-note">
              {gestureEnabled && handControls.status === "ready"
                ? "Palm: rotate. Pinch + move up/down: zoom. Fist: reset. Drag and zoom also work. "
                : gestureEnabled && handControls.status === "unavailable"
                  ? "Hand controls are unavailable for this viewer. Drag and zoom inside the viewer. "
                  : "Drag and zoom inside the viewer. "}
              Animations are available when included in the model. Creator
              annotations start hidden for a clear presentation.
              {model.uid === featuredEngine.uid
                ? " This assembly shows the pistons, connecting rods and crankshaft."
                : ""}
            </p>
          </div>
        </details>
      </div>
      {[controls.camera.error, controls.animation.error].filter(Boolean)
        .length > 0 && (
        <p className="model-control-error" role="status">
          {[controls.camera.error, controls.animation.error]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </div>
  );
}

export function ExternalModels({
  initialQuery = "",
  onModelSelect,
  selectedModelId,
  onFileSelect,
  onCatalogSelect,
  loadingModelId,
  selectedCatalogId,
  modelLoadError,
}: {
  initialQuery?: string;
  onModelSelect?: (model: ExternalModel) => void;
  selectedModelId?: string | null;
  onFileSelect?: (file: File) => void;
  onCatalogSelect?: (source: NativeCatalogEntry) => void;
  loadingModelId?: string | null;
  selectedCatalogId?: string | null;
  modelLoadError?: string;
}) {
  const [query, setQuery] = useState(initialQuery || "four cylinder engine");
  const [models, setModels] = useState<ExternalModel[]>([]);
  const [selected, setSelected] = useState<ExternalModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);
  useEffect(
    () => () => {
      const pending = controller.current;
      controller.current = null;
      pending?.abort();
    },
    [],
  );
  async function search(event: FormEvent) {
    event.preventDefault();
    const clean = query.trim();
    if (clean.length < 2 || clean.length > 100) {
      setNotice("Use between 2 and 100 characters to search.");
      return;
    }
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    const timer = window.setTimeout(() => requestController.abort(), 11000);
    setLoading(true);
    setNotice("");
    setSearched(true);
    try {
      const response = await fetch(
        `/api/models?q=${encodeURIComponent(clean)}`,
        { signal: requestController.signal },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("Search unavailable");
      const data = (await response.json()) as { models?: ExternalModel[] };
      if (!Array.isArray(data.models)) throw new Error("Invalid model search");
      if (controller.current !== requestController) return;
      const safeModels = data.models
        .filter((model) => /^[a-f0-9]{32}$/i.test(model.uid))
        .slice(0, 12);
      setModels(safeModels);
      if (!safeModels.length)
        setNotice(
          "No models found. Try a broader topic, such as “engine” or “human heart”.",
        );
    } catch {
      if (controller.current !== requestController) return;
      setModels([]);
      setNotice(
        "Live model search is unavailable right now. The featured engine below is still available to open.",
      );
    } finally {
      clearTimeout(timer);
      if (controller.current === requestController) setLoading(false);
    }
  }
  const currentSelection =
    selectedModelId !== undefined ? selectedModelId : selected?.uid;
  const pick = (model: ExternalModel) => {
    setSelected(model);
    onModelSelect?.(model);
  };
  return (
    <section className="external-models" aria-label="Detailed 3D model library">
      <div className="external-models-heading">
        <div>
          <span>ANOTHER PERSPECTIVE</span>
          <h3>Explore a detailed 3D model</h3>
          <p>
            Explore assemblies, structures and objects in your presentation.
          </p>
        </div>
        {onFileSelect && (
          <button
            className="model-file-button"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="plus" size={16} /> Open model file
          </button>
        )}
      </div>
      {onFileSelect && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept=".glb"
            className="model-file-input"
            aria-label="Open GLB model file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!/\.glb$/i.test(file.name)) {
                setFileError("Choose a self-contained .glb model file.");
                return;
              }
              if (file.size > 50 * 1024 * 1024) {
                setFileError("Choose a GLB file smaller than 50 MB.");
                return;
              }
              if (!file.size) {
                setFileError("This file is empty. Choose another GLB model.");
                return;
              }
              setFileError("");
              onFileSelect(file);
            }}
          />
          <p className="model-file-hint">
            Have a GLB model? Open it directly in Vision. The file stays in your
            browser.
          </p>
          {fileError && (
            <p className="external-search-notice" role="alert">
              {fileError}
            </p>
          )}
        </>
      )}
      {onCatalogSelect && (
        <div className="native-catalog" aria-label="Vision model library">
          <p className="native-catalog-label">READY IN VISION</p>
          <div className="native-catalog-grid">
            {nativeCatalog.map((source) => (
              <button
                type="button"
                className="native-catalog-card"
                key={source.id}
                onClick={() => onCatalogSelect(source)}
                disabled={loadingModelId === source.id}
                aria-pressed={selectedCatalogId === source.id}
                aria-label={`Open ${source.title}`}
              >
                <div className="native-catalog-preview">
                  <img src={source.preview} alt="" loading="lazy" />
                  <span>
                    <Icon name="arrow-up-right" size={16} />
                  </span>
                </div>
                <strong>{source.title}</strong>
                <span className="native-catalog-description">
                  {source.description}
                </span>
                <span className="native-catalog-size">
                  {loadingModelId === source.id
                    ? "Opening model…"
                    : source.size}
                </span>
              </button>
            ))}
          </div>
          {loadingModelId && (
            <p className="native-catalog-status" role="status">
              Opening your model. Your current board stays in place.
            </p>
          )}
          {modelLoadError && (
            <p className="external-search-notice" role="alert">
              {modelLoadError}
            </p>
          )}
        </div>
      )}
      <form className="external-model-search" onSubmit={search}>
        <label htmlFor="external-model-query">
          Search more models on Sketchfab
        </label>
        <div>
          <input
            id="external-model-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try engine, heart, solar system…"
            maxLength={100}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search models"}
          </button>
        </div>
      </form>
      {notice && (
        <p className="external-search-notice" role="status">
          {notice}
        </p>
      )}
      {selected && !onModelSelect && (
        <ModelViewer model={selected} onClose={() => setSelected(null)} />
      )}
      <div className="external-featured">
        <div>
          <span>FEATURED ASSEMBLY</span>
          <strong>See how pistons drive a crankshaft.</strong>
          <p>
            Animated four-cylinder mechanism by {featuredEngine.author} ·{" "}
            {featuredEngine.license}
          </p>
        </div>
        <button
          type="button"
          onClick={() => pick(featuredEngine)}
          aria-pressed={currentSelection === featuredEngine.uid}
        >
          Open engine <span aria-hidden="true">↗</span>
        </button>
      </div>
      {models.length > 0 && (
        <>
          <p className="external-results-label">
            {models.length} models from Sketchfab
          </p>
          <div className="external-model-results">
            {models.map((model) => (
              <article key={model.uid} className="external-model-result">
                <button
                  className="external-model-preview"
                  type="button"
                  onClick={() => pick(model)}
                  aria-label={`Open ${model.title}`}
                  aria-pressed={currentSelection === model.uid}
                >
                  {model.thumbnail ? (
                    <img src={model.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <span>3D</span>
                  )}
                  {model.animated && (
                    <span className="external-animation-label">Animated</span>
                  )}
                </button>
                <div>
                  <h4>{model.title}</h4>
                  <p>
                    by{" "}
                    <a href={model.authorUrl} target="_blank" rel="noreferrer">
                      {model.author}
                    </a>
                  </p>
                  <span className="external-license">{model.license}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {!searched && (
        <p className="external-search-hint">
          Search when you need more detail. Your current board stays in place.
        </p>
      )}
    </section>
  );
}
