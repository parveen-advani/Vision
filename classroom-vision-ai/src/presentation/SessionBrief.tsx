import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import type { Audience, PresentationLanguage, SessionContext } from "./types";
import { importDocument, MAX_CONTEXT_CHARACTERS } from "./importDocument";
import type { ImportedDocument } from "./importDocument";
import "./session-brief.css";

const audienceLabels: Record<Audience, string> = {
  general: "General audience",
  students: "Students",
  executives: "Executives",
  technical: "Technical audience",
};
const languageLabels: Record<PresentationLanguage, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
};

export function SessionBrief({
  context,
  onChange,
  disabled = false,
}: {
  context: SessionContext;
  onChange: (context: SessionContext) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const importController = useRef<AbortController | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportedDocument | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => () => importController.current?.abort(), []);

  const patch = (change: Partial<SessionContext>) =>
    onChange({ ...context, ...change });

  const readFile = async (file?: File) => {
    if (!file || disabled) return;
    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    setImporting(true);
    setError("");
    setNotice("");
    setPreview(null);
    setProgress("Reading your document…");
    try {
      const imported = await importDocument(file, {
        signal: controller.signal,
        onProgress: (message) => {
          if (!controller.signal.aborted) setProgress(message);
        },
      });
      if (controller.signal.aborted) return;
      setPreview(imported);
      setPreviewText(imported.text);
      setNotice(`${file.name} is ready to review.`);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "The document could not be read. Try another file.",
        );
    } finally {
      if (
        importController.current === controller &&
        !controller.signal.aborted
      ) {
        importController.current = null;
        setImporting(false);
        setProgress("");
      }
    }
  };

  const cancelImport = () => {
    importController.current?.abort();
    importController.current = null;
    setImporting(false);
    setProgress("");
    setNotice("Import cancelled. Your current notes are unchanged.");
  };

  const useNotes = () => {
    if (!preview || !previewText.trim() || disabled) return;
    patch({
      notes: previewText.trim().slice(0, MAX_CONTEXT_CHARACTERS),
      documentName: preview.name,
    });
    setPreview(null);
    setNotice("Notes added to this session. You can edit them below.");
  };

  return (
    <details className="session-brief">
      <summary className="brief-summary">
        <span className="brief-summary-icon">
          <Icon name="book" size={19} />
        </span>
        <span className="brief-summary-copy">
          <strong>Session brief</strong>
          <span>
            {context.topic.trim() ||
              "A little context makes a clearer explanation."}
          </span>
        </span>
        <span className="brief-summary-meta">
          {audienceLabels[context.audience]}
          <span aria-hidden="true">·</span>
          {languageLabels[context.language]}
        </span>
        <Icon name="chevron-down" size={17} className="brief-chevron" />
      </summary>

      <fieldset className="brief-fields" disabled={disabled}>
        <legend className="brief-sr-only">Presentation context</legend>
        <div className="brief-field brief-topic">
          <label htmlFor={`${id}-topic`}>What are you presenting?</label>
          <input
            id={`${id}-topic`}
            value={context.topic}
            onChange={(event) => patch({ topic: event.target.value })}
            maxLength={180}
            placeholder="A strategy update, engine basics, or your next idea"
            autoComplete="off"
          />
        </div>

        <div className="brief-options">
          <div className="brief-field">
            <label htmlFor={`${id}-audience`}>Audience</label>
            <select
              id={`${id}-audience`}
              value={context.audience}
              onChange={(event) =>
                patch({ audience: event.target.value as Audience })
              }
            >
              {Object.entries(audienceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="brief-field">
            <label htmlFor={`${id}-language`}>Explanation language</label>
            <select
              id={`${id}-language`}
              value={context.language}
              onChange={(event) =>
                patch({ language: event.target.value as PresentationLanguage })
              }
            >
              {Object.entries(languageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="brief-field">
            <label htmlFor={`${id}-detail`}>Level of detail</label>
            <select
              id={`${id}-detail`}
              value={context.detail}
              onChange={(event) =>
                patch({
                  detail: event.target.value as SessionContext["detail"],
                })
              }
            >
              <option value="brief">Brief · the essentials</option>
              <option value="balanced">Balanced · explain clearly</option>
              <option value="deep">In depth · explore the detail</option>
            </select>
          </div>
        </div>

        <div className="brief-import-row">
          <div>
            <strong>Bring your own material</strong>
            <p>PPTX, PDF, TXT or Markdown · up to 20 MB</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".pptx,.pdf,.txt,.md"
            onChange={(event) => {
              void readFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            className="brief-import-button"
            type="button"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="plus" size={16} />
            Import notes
          </button>
        </div>
        <p className="brief-privacy">
          <Icon name="info" size={14} />
          Files are read in this browser. Added notes are sent with your copilot
          requests.
        </p>

        {importing && (
          <div className="brief-import-progress">
            <p role="status">
              <Icon name="clock" size={16} />
              {progress}
            </p>
            <button type="button" onClick={cancelImport}>
              Cancel
            </button>
          </div>
        )}
        {error && (
          <p className="brief-error" role="alert">
            {error}
          </p>
        )}
        {!importing && notice && (
          <p className="brief-notice" role="status">
            {notice}
          </p>
        )}

        {preview && (
          <section
            className="brief-preview"
            aria-labelledby={`${id}-preview-title`}
          >
            <div className="brief-preview-heading">
              <div>
                <span>REVIEW IMPORT</span>
                <h3 id={`${id}-preview-title`}>{preview.name}</h3>
              </div>
              <button
                type="button"
                className="brief-icon-button"
                onClick={() => {
                  setPreview(null);
                  setNotice("");
                }}
                aria-label="Dismiss imported notes"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <p className="brief-preview-description">
              Review or edit the text before adding it. Using these notes
              replaces any existing session notes.
            </p>
            {preview.warnings.length > 0 && (
              <ul className="brief-import-warnings">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <label className="brief-sr-only" htmlFor={`${id}-preview`}>
              Imported text preview
            </label>
            <textarea
              id={`${id}-preview`}
              value={previewText}
              onChange={(event) =>
                setPreviewText(
                  event.target.value.slice(0, MAX_CONTEXT_CHARACTERS),
                )
              }
              maxLength={MAX_CONTEXT_CHARACTERS}
              rows={7}
            />
            <div className="brief-preview-actions">
              <span>
                {previewText.length.toLocaleString()} / 12,000 characters
              </span>
              <button
                className="brief-use-button"
                type="button"
                disabled={!previewText.trim()}
                onClick={useNotes}
              >
                <Icon name="check" size={16} />
                Use notes
              </button>
            </div>
          </section>
        )}

        <div className="brief-field brief-notes">
          <div className="brief-notes-label">
            <label htmlFor={`${id}-notes`}>Context &amp; notes</label>
            {context.notes && (
              <button
                type="button"
                onClick={() => {
                  patch({ notes: "", documentName: "" });
                  setNotice("Session notes cleared.");
                }}
              >
                Clear notes
              </button>
            )}
          </div>
          <p id={`${id}-notes-help`}>
            Add key facts, definitions, or what your audience already knows.
          </p>
          <textarea
            id={`${id}-notes`}
            value={context.notes}
            onChange={(event) =>
              patch({
                notes: event.target.value.slice(0, MAX_CONTEXT_CHARACTERS),
              })
            }
            maxLength={MAX_CONTEXT_CHARACTERS}
            rows={4}
            aria-describedby={`${id}-notes-help ${id}-notes-count`}
            placeholder="For example: This is an introduction for first-year students. Focus on what each part does, and use everyday comparisons."
          />
          <div className="brief-notes-meta">
            <span title={context.documentName}>
              {context.documentName
                ? `From ${context.documentName}`
                : "Optional · edit at any time"}
            </span>
            <span id={`${id}-notes-count`}>
              {context.notes.length.toLocaleString()} / 12,000
            </span>
          </div>
        </div>
      </fieldset>
    </details>
  );
}
