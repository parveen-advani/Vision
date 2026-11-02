import { useEffect, useMemo, useRef, useState } from "react";
import { visualLibrary } from "../data/visualLibrary";
import type { VisualId } from "../types";
import { Icon } from "./Icon";
import { ModelThumbnail } from "./ModelThumbnail";

export const categoryLabels: Record<string, string> = {
  biology: "Biology",
  physics: "Physics",
  "computer-science": "Computer science",
  "earth-science": "Earth science",
};

export function LibraryPanel({
  activeId,
  onSelect,
  onOpenHelp,
  isOpen,
  onClose,
}: {
  activeId: VisualId;
  onSelect: (id: VisualId) => void;
  onOpenHelp: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    drawer.current?.querySelector<HTMLInputElement>("input")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);
  const filtered = useMemo(
    () =>
      visualLibrary.filter(
        (visual) =>
          (category === "all" || visual.category === category) &&
          (
            visual.title +
            " " +
            visual.keywords.join(" ") +
            " " +
            categoryLabels[visual.category]
          )
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [query, category],
  );

  return (
    <aside
      ref={drawer}
      id="model-library"
      className={"library-sidebar " + (isOpen ? "is-open" : "")}
      aria-label="Model library"
      role={isOpen ? "dialog" : undefined}
      aria-modal={isOpen ? true : undefined}
      onKeyDown={(event) => {
        if (!isOpen || event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "a, button, input, select",
          ),
        ).filter(
          (element) =>
            !element.hasAttribute("disabled") &&
            element.getClientRects().length > 0,
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <a
        href="#main-workspace"
        className="brand"
        aria-label="Vision classroom studio"
      >
        <span className="brand-symbol" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="brand-wordmark">
          vision<span className="brand-period">.</span>
        </span>
        <span className="brand-edition">CLASSROOM</span>
      </a>
      <button
        className="icon-button sidebar-close"
        type="button"
        onClick={onClose}
        aria-label="Close model library"
      >
        <Icon name="close" />
      </button>
      <div className="sidebar-workspace">
        <span className="small-label">YOUR WORKSPACE</span>
        <div className="studio-nav">
          <Icon name="grid" size={18} />
          <span>Teaching studio</span>
          <span className="nav-current-dot" />
        </div>
      </div>
      <section className="sidebar-library">
        <div className="library-heading">
          <h2 className="small-label">MODEL LIBRARY</h2>
          <span className="library-count">
            {String(visualLibrary.length).padStart(2, "0")}
          </span>
        </div>
        <div className="library-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            aria-label="Search models"
            placeholder="Find a model…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              className="search-clear"
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear model search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        <div className="library-filter">
          <label htmlFor="subject-filter">Subject</label>
          <select
            id="subject-filter"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All subjects</option>
            {Object.entries(categoryLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="library-list">
          {filtered.map((visual) => (
            <button
              key={visual.id}
              className={
                "library-card " + (visual.id === activeId ? "active" : "")
              }
              type="button"
              onClick={() => onSelect(visual.id)}
              aria-pressed={visual.id === activeId}
            >
              <span
                className={"thumbnail-wrap thumbnail-wrap--" + visual.category}
              >
                <ModelThumbnail id={visual.id} />
              </span>
              <span className="library-card-copy">
                <strong>
                  {visual.id === "heart" ? "Human heart" : visual.shortTitle}
                </strong>
                <small>{categoryLabels[visual.category]}</small>
              </span>
              {visual.id === activeId && (
                <span className="library-selected">
                  <Icon name="check" size={13} />
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="library-empty" role="status">
              <Icon name="search" size={24} />
              <strong>No models found</strong>
              <p>Try a different topic or subject.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>
      <div className="sidebar-bottom">
        <div className="library-note">
          <span className="note-orbit" aria-hidden="true">
            <span />
          </span>
          <p>
            A different perspective.
            <br />
            <strong>A deeper understanding.</strong>
          </p>
        </div>
        <button className="sidebar-help" type="button" onClick={onOpenHelp}>
          <Icon name="keyboard" size={18} />
          <span>Keyboard shortcuts</span>
          <kbd>?</kbd>
        </button>
        <div className="sidebar-footnote">
          <span className="online-dot" />
          All models ready to explore
        </div>
      </div>
    </aside>
  );
}
