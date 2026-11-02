import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ExternalModel } from "./types";
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

interface ViewerApi {
  start: () => void;
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener?: (event: string, callback: () => void) => void;
  setEnableCameraConstraints?: (enabled: boolean) => void;
  getCameraLookAt?: (
    callback: (
      error: unknown,
      camera: { position: number[]; target: number[] },
    ) => void,
  ) => void;
  setCameraLookAt?: (
    position: number[],
    target: number[],
    duration: number,
  ) => void;
}
interface ViewerClient {
  init: (
    uid: string,
    options: {
      autostart: number;
      dnt: number;
      camera: number;
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
}: {
  model: ExternalModel;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
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
      viewer.getCameraLookAt?.((error, camera) => {
        if (!active || error || !camera) return;
        // Preserve the framing horizontally when presentation mode makes the iframe taller.
        const position = camera.position.map(
          (value, index) =>
            camera.target[index] +
            (value - camera.target[index]) * distanceScale,
        );
        viewer.setEnableCameraConstraints?.(false);
        viewer.setCameraLookAt?.(position, camera.target, 0.25);
      });
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
    const timeout = window.setTimeout(() => {
      if (active) setState("error");
    }, 25000);
    const onReady = () => {
      if (active) {
        ready = true;
        clearTimeout(timeout);
        setState("ready");
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
  }, [model.uid, retry]);
  return (
    <div className="external-viewer" data-viewer-state={state}>
      <div className="external-viewer-title">
        <div>
          <span>DETAILED 3D VIEW</span>
          <h4>{model.title}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detailed model"
        >
          ×
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
      <div className="external-attribution">
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
          View provided by Sketchfab ↗
        </a>
      </div>
      <p className="external-controls-note">
        Drag and zoom inside the viewer. Available animations and annotations
        depend on the creator’s model.
        {model.uid === featuredEngine.uid
          ? " This assembly shows the pistons, connecting rods and crankshaft."
          : ""}
      </p>
    </div>
  );
}

export function ExternalModels({
  initialQuery = "",
  onModelSelect,
  selectedModelId,
}: {
  initialQuery?: string;
  onModelSelect?: (model: ExternalModel) => void;
  selectedModelId?: string | null;
}) {
  const [query, setQuery] = useState(initialQuery || "four cylinder engine");
  const [models, setModels] = useState<ExternalModel[]>([]);
  const [selected, setSelected] = useState<ExternalModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);
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
            Real assemblies and artist-made models, with the original creator’s
            controls.
          </p>
        </div>
        <a href="https://sketchfab.com" target="_blank" rel="noreferrer">
          Sketchfab ↗
        </a>
      </div>
      <form className="external-model-search" onSubmit={search}>
        <label htmlFor="external-model-query">
          Find a model for this topic
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
