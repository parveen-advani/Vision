import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { EngineDiagram } from "./EngineDiagram";
import type { SessionCard } from "./types";

const kindLabels = {
  model: "Interactive model",
  engine: "Interactive explainer",
  flow: "Step by step",
  comparison: "Side by side",
  chart: "A visual example",
  explanation: "Concept explained",
};
export function ConceptBoard({
  card,
  model,
  onAsk,
  onDetailedModel,
}: {
  card: SessionCard;
  model: ReactNode;
  onAsk: (message: string, trigger?: "simplify" | "deeper") => void;
  onDetailedModel?: () => void;
}) {
  const p = card.plan;
  const maxValue = Math.max(1, ...p.metrics.map((m) => Math.abs(m.value)));
  return (
    <article
      className={"concept-board concept-board--" + p.kind}
      aria-labelledby="concept-title"
    >
      <header className="concept-heading">
        <div className="concept-meta">
          <span>
            <span className="concept-dot" />
            {kindLabels[p.kind]}
          </span>
          <span>
            {card.source === "ai" ? "AI explanation" : "Prepared guide"}
          </span>
        </div>
        <h2 id="concept-title">{p.title}</h2>
        <p className="concept-takeaway">{p.takeaway}</p>
        {p.kind === "engine" && onDetailedModel && (
          <button
            className="detailed-model-button"
            type="button"
            onClick={onDetailedModel}
          >
            <Icon name="layers" size={15} />
            Explore the detailed 3D engine
            <Icon name="arrow-up-right" size={14} />
          </button>
        )}
      </header>
      {p.kind === "model" && model}
      {p.kind === "engine" && <EngineDiagram />}
      {p.kind === "flow" && (
        <ol className="concept-flow">
          {p.steps.map((step, i) => (
            <li key={i}>
              <span className="flow-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </div>
              {i < p.steps.length - 1 && <Icon name="arrow-right" size={22} />}
            </li>
          ))}
        </ol>
      )}
      {p.kind === "comparison" && (
        <div className="concept-comparison">
          {p.comparison.map((column, i) => (
            <section key={i}>
              <span className="comparison-index">0{i + 1}</span>
              <h3>{column.heading}</h3>
              <ul>
                {column.points.map((point, n) => (
                  <li key={n}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {p.kind === "chart" && (
        <div
          className="concept-chart"
          role="figure"
          aria-label={p.title + " chart"}
        >
          {p.metrics.map((metric, i) => (
            <div className="chart-row" key={i}>
              <div>
                <span>{metric.label}</span>
                <strong>
                  {metric.value.toLocaleString()} <small>{metric.unit}</small>
                </strong>
              </div>
              <span className="chart-track">
                <span
                  style={{
                    width:
                      Math.max(2, (Math.abs(metric.value) / maxValue) * 100) +
                      "%",
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      {p.kind === "explanation" && p.keyPoints.length > 0 && (
        <div className="concept-keypoints">
          {p.keyPoints.map((point, i) => (
            <div key={i}>
              <span>0{i + 1}</span>
              <p>{point}</p>
            </div>
          ))}
        </div>
      )}
      <div className="concept-body">
        {p.explanation && (
          <p className="concept-explanation">{p.explanation}</p>
        )}
        {p.analogy && (
          <div className="concept-analogy">
            <span>THINK OF IT THIS WAY</span>
            <p>{p.analogy}</p>
          </div>
        )}
        {p.kind !== "explanation" && p.keyPoints.length > 0 && (
          <ul className="concept-talking-points">
            {p.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        )}
        {p.caveat && (
          <p className="concept-caveat">
            <Icon name="info" size={15} />
            {p.caveat}
          </p>
        )}
        {p.citations.length > 0 && (
          <div className="concept-sources">
            <span>References</span>
            {p.citations.map((citation, i) => (
              <a
                key={i}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {citation.title}
                <Icon name="arrow-up-right" size={12} />
              </a>
            ))}
          </div>
        )}
      </div>
      <footer className="concept-followups">
        <span>Continue the conversation</span>
        <div>
          <button
            type="button"
            onClick={() =>
              onAsk(
                "Explain this more simply with a concrete example.",
                "simplify",
              )
            }
          >
            Make it simpler
            <Icon name="arrow-right" size={13} />
          </button>
          <button
            type="button"
            onClick={() =>
              onAsk(
                "Go deeper into this concept and explain how it works.",
                "deeper",
              )
            }
          >
            Go deeper
            <Icon name="arrow-right" size={13} />
          </button>
          {p.followUps.slice(0, 2).map((question, i) => (
            <button type="button" key={i} onClick={() => onAsk(question)}>
              {question}
              <Icon name="arrow-right" size={13} />
            </button>
          ))}
        </div>
      </footer>
    </article>
  );
}

export function WelcomeBoard({
  onExample,
  processing,
}: {
  onExample: (message: string) => void;
  processing: boolean;
}) {
  return (
    <section className="welcome-board" aria-labelledby="welcome-board-title">
      <div className="welcome-board-top">
        <span className="board-label">YOUR LIVE CANVAS</span>
        <span className="welcome-board-mark">V / 01</span>
      </div>
      <div className="welcome-copy">
        <span className="welcome-kicker">
          A better way to say “let me explain.”
        </span>
        <h2 id="welcome-board-title">
          Give your ideas
          <br />
          <em>a little dimension.</em>
        </h2>
        <p>
          Bring the conversation. Vision helps you turn the difficult part into
          something everyone can see.
        </p>
      </div>
      <div className="welcome-illustration" aria-hidden="true">
        <div className="illustration-note">
          <span>THE QUESTION</span>
          <p>
            “How does
            <br />
            that work?”
          </p>
          <div className="note-lines">
            <i />
            <i />
          </div>
        </div>
        <div className="illustration-connector">
          <i />
          <span>→</span>
          <i />
        </div>
        <div className="illustration-visual">
          <span>THE AHA MOMENT</span>
          <svg viewBox="0 0 220 130" fill="none">
            <path d="M35 98 110 121 185 98 110 74Z" fill="#e4e9dc" />
            <path
              d="M65 75V36L110 15 155 36V75L110 98Z"
              fill="#d9e3ce"
              stroke="#4b6854"
              strokeWidth="1.5"
            />
            <path
              d="m65 36 45 23 45-23M110 59v39"
              stroke="#4b6854"
              strokeWidth="1.5"
            />
            <path
              d="M40 60H17m166 0h22M110 8V0"
              stroke="#9d9f7f"
              strokeWidth="1.5"
            />
            <circle cx="17" cy="60" r="3" fill="#bca474" />
            <circle cx="205" cy="60" r="3" fill="#bca474" />
          </svg>
          <span className="illustration-caption">
            Clarity, from every angle.
          </span>
        </div>
      </div>
      <div className="welcome-examples">
        <span>START WITH A CONVERSATION</span>
        <button
          type="button"
          disabled={processing}
          onClick={() =>
            onExample(
              "Explain how a four-stroke car engine works and show its parts to students.",
            )
          }
        >
          <span className="example-number">01</span>
          <span>
            <strong>Inside a car engine</strong>
            <small>A professor. A curious classroom.</small>
          </span>
          <Icon name="arrow-up-right" size={19} />
        </button>
        <button
          type="button"
          disabled={processing}
          onClick={() =>
            onExample(
              "Explain gross margin to a non-finance audience with a simple visual example.",
            )
          }
        >
          <span className="example-number">02</span>
          <span>
            <strong>Make the numbers make sense</strong>
            <small>A presenter. A room full of questions.</small>
          </span>
          <Icon name="arrow-up-right" size={19} />
        </button>
      </div>
    </section>
  );
}
