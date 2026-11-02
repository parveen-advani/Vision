import { useEffect, useId, useState } from "react";
import "./engine.css";

const parts = [
  {
    id: "piston",
    name: "Piston",
    detail:
      "Moves up and down inside the cylinder. Expanding gases push it downward during the power stroke.",
  },
  {
    id: "cylinder",
    name: "Cylinder",
    detail:
      "Guides the piston and contains the changing volume where the air–fuel mixture is compressed and burned.",
  },
  {
    id: "rod",
    name: "Connecting rod",
    detail:
      "Links the piston to the crankshaft, transferring force between their linear and rotating motion.",
  },
  {
    id: "crankshaft",
    name: "Crankshaft",
    detail:
      "Converts the piston’s back-and-forth motion into rotation that can drive a load.",
  },
  {
    id: "intake",
    name: "Intake valve",
    detail:
      "Opens during intake to let the air–fuel charge enter. It closes before compression.",
  },
  {
    id: "exhaust",
    name: "Exhaust valve",
    detail:
      "Opens during the exhaust stroke so the rising piston can push burned gases out.",
  },
  {
    id: "spark",
    name: "Spark plug",
    detail:
      "Ignites the compressed mixture in this spark-ignition example. Diesel engines use compression ignition instead.",
  },
] as const;
type PartId = (typeof parts)[number]["id"];
const strokes = [
  {
    name: "Intake",
    motion: "Piston moves down",
    detail:
      "The intake valve opens. As the piston descends, a fresh air–fuel charge enters the cylinder.",
    color: "#b7d3cf",
    piston: 294,
    crank: 155,
  },
  {
    name: "Compression",
    motion: "Piston moves up",
    detail:
      "Both valves are closed. The rising piston compresses the mixture into a smaller space.",
    color: "#d9c29a",
    piston: 222,
    crank: 335,
  },
  {
    name: "Power",
    motion: "Piston moves down",
    detail:
      "Near the top of compression, the spark ignites the charge. Expanding gases drive the piston down.",
    color: "#dba78d",
    piston: 294,
    crank: 515,
  },
  {
    name: "Exhaust",
    motion: "Piston moves up",
    detail:
      "The exhaust valve opens. The rising piston pushes spent gases out, ready for the next cycle.",
    color: "#c6c2b6",
    piston: 222,
    crank: 695,
  },
];

export function EngineDiagram() {
  const [selected, setSelected] = useState<PartId>("piston");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const gradientId = useId().replace(/:/g, "");
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setStep((value) => (value + 1) % 4),
      2200,
    );
    return () => window.clearInterval(timer);
  }, [playing]);
  const stroke = strokes[step];
  const part = parts.find((entry) => entry.id === selected)!;
  const interactive = (id: PartId) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": `Inspect ${parts.find((entry) => entry.id === id)!.name}`,
    "aria-pressed": selected === id,
    className: `engine-part${selected === id ? " is-selected" : ""}`,
    onClick: () => setSelected(id),
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelected(id);
      }
    },
  });
  return (
    <section
      className="engine-diagram"
      aria-label="Interactive four-stroke engine cutaway"
    >
      <div className="engine-diagram-heading">
        <div>
          <span className="engine-kicker">MECHANISM EXPLORER</span>
          <h3>One cylinder. Four strokes.</h3>
        </div>
        <button
          type="button"
          className="engine-play"
          onClick={() => setPlaying((value) => !value)}
          aria-pressed={playing}
        >
          {playing ? "Pause cycle" : "Play cycle"}
          <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>
        </button>
      </div>
      <div className="engine-explorer-grid">
        <div className="engine-illustration">
          <svg
            viewBox="0 0 680 520"
            aria-label="Spark ignition engine: valves, cylinder, piston, connecting rod and crankshaft"
          >
            <defs>
              <linearGradient id={`${gradientId}-metal`} x1="0" x2="1">
                <stop stopColor="#c0c7bc" />
                <stop offset=".45" stopColor="#eff1e9" />
                <stop offset="1" stopColor="#a9b5a8" />
              </linearGradient>
              <linearGradient id={`${gradientId}-piston`} x1="0" x2="1">
                <stop stopColor="#95a99b" />
                <stop offset=".5" stopColor="#d2ddcf" />
                <stop offset="1" stopColor="#718d7b" />
              </linearGradient>
            </defs>
            <path d="M95 470H585" stroke="#d8dece" strokeWidth="1" />
            <ellipse
              cx="340"
              cy="474"
              rx="118"
              ry="10"
              fill="#304d3a"
              opacity=".045"
            />
            <g {...interactive("cylinder")}>
              <path
                d="M240 169H268V354H412V169H440V380H240Z"
                fill={`url(#${gradientId}-metal)`}
                stroke="#8f9f8d"
                strokeWidth="2"
              />
              <path
                d="M241 184H440M241 207H267M413 207H439M241 230H267M413 230H439M241 253H267M413 253H439M241 276H267M413 276H439M241 299H267M413 299H439M241 322H267M413 322H439"
                stroke="#889a88"
                opacity=".7"
                strokeWidth="2"
              />
            </g>
            <rect
              x="269"
              y="173"
              width="142"
              height={stroke.piston - 172}
              fill={stroke.color}
              opacity=".58"
              className="engine-charge"
            />
            <path
              d="M219 157H461V179H219Z"
              fill={`url(#${gradientId}-metal)`}
              stroke="#8f9f8d"
              strokeWidth="2"
            />
            <g {...interactive("intake")}>
              <path
                d="M166 117H242L296 164"
                fill="none"
                stroke="#82a9a0"
                strokeWidth="24"
              />
              <path
                d="M166 117H242L296 164"
                fill="none"
                stroke="#e0ebe3"
                strokeWidth="11"
              />
              <g
                transform={`translate(0 ${step === 0 ? 14 : 0})`}
                className="engine-valve"
              >
                <path d="M282 104L304 166" stroke="#6e8f81" strokeWidth="7" />
                <path
                  d="M288 170L316 159"
                  stroke="#496d5c"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
              </g>
            </g>
            <g {...interactive("exhaust")}>
              <path
                d="M384 164L438 117H514"
                fill="none"
                stroke="#b9a894"
                strokeWidth="24"
              />
              <path
                d="M384 164L438 117H514"
                fill="none"
                stroke="#ece5d9"
                strokeWidth="11"
              />
              <g
                transform={`translate(0 ${step === 3 ? 14 : 0})`}
                className="engine-valve"
              >
                <path d="M398 104L376 166" stroke="#9d927a" strokeWidth="7" />
                <path
                  d="M364 159L392 170"
                  stroke="#7c735e"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
              </g>
            </g>
            <g {...interactive("spark")}>
              <path
                d="M333 104H347V142H333Z"
                fill="#f5f0dc"
                stroke="#9d9982"
                strokeWidth="2"
              />
              <path d="M329 141H351V157H329Z" fill="#829586" />
              <path
                d="M340 156V181M340 181H347V174"
                fill="none"
                stroke="#687c68"
                strokeWidth="3"
              />
              {step === 2 && (
                <path
                  d="M344 184L337 195L345 195L339 207"
                  fill="none"
                  stroke="#c88733"
                  strokeWidth="3"
                />
              )}
            </g>
            <g {...interactive("crankshaft")}>
              <circle
                cx="340"
                cy="423"
                r="44"
                fill={`url(#${gradientId}-metal)`}
                stroke="#92a18c"
                strokeWidth="2"
              />
              <g
                style={{
                  transform: `rotate(${stroke.crank}deg)`,
                  transformOrigin: "340px 423px",
                }}
                className="engine-crank"
              >
                <path
                  d="M340 386V460M303 423H377"
                  stroke="#a6b29d"
                  strokeWidth="9"
                />
                <circle cx="340" cy="397" r="9" fill="#526f5d" />
              </g>
              <circle
                cx="340"
                cy="423"
                r="12"
                fill="#d4ddcc"
                stroke="#81977e"
                strokeWidth="3"
              />
            </g>
            <g {...interactive("rod")}>
              <path
                d={`M340 ${stroke.piston + 30}L340 397`}
                fill="none"
                stroke="#829a86"
                strokeWidth="15"
                className="engine-rod"
              />
              <path
                d={`M340 ${stroke.piston + 30}L340 397`}
                fill="none"
                stroke="#d7e1d1"
                strokeWidth="5"
                className="engine-rod"
              />
              <circle
                cx="340"
                cy="397"
                r="10"
                fill="#bac9b5"
                stroke="#6a846d"
                strokeWidth="3"
              />
            </g>
            <g
              {...interactive("piston")}
              transform={`translate(0 ${stroke.piston})`}
              className={`${interactive("piston").className} engine-piston`}
            >
              <rect
                x="274"
                width="132"
                height="48"
                rx="4"
                fill={`url(#${gradientId}-piston)`}
                stroke="#6e8874"
                strokeWidth="2"
              />
              <path
                d="M276 10H404M276 17H404"
                stroke="#526b57"
                strokeWidth="3"
              />
              <circle
                cx="340"
                cy="33"
                r="9"
                fill="#dfe7d7"
                stroke="#70866c"
                strokeWidth="3"
              />
            </g>
            {step === 0 && (
              <path
                d="M178 116H228L266 151M254 133L266 151L245 147"
                fill="none"
                stroke="#416f65"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            {step === 3 && (
              <path
                d="M410 144L442 117H499M487 107L499 117L487 127"
                fill="none"
                stroke="#9b7453"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            <g className="engine-svg-labels" fill="#62725e">
              <text x="126" y="88">
                INTAKE
              </text>
              <text x="472" y="88">
                EXHAUST
              </text>
              <text x="340" y="68" textAnchor="middle">
                SPARK PLUG
              </text>
              <path d="M340 76V98" stroke="#c2cbbb" />
              <text x="185" y="268" textAnchor="end">
                CYLINDER
              </text>
              <path d="M191 264H235" stroke="#b1bfaa" />
              <text x="484" y={stroke.piston + 25}>
                PISTON
              </text>
              <path d={`M411 ${stroke.piston + 21}H476`} stroke="#b1bfaa" />
              <text x="478" y="428">
                CRANKSHAFT
              </text>
              <path d="M389 423H470" stroke="#b1bfaa" />
            </g>
          </svg>
          <div className="engine-figure-caption">
            <span>Click a part to explore</span>
            <span>Conceptual cutaway · not to scale</span>
          </div>
        </div>
        <div className="engine-parts-panel">
          <span className="engine-kicker">EXPLORE THE PARTS</span>
          <div className="engine-part-buttons">
            {parts.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelected(entry.id)}
                aria-pressed={selected === entry.id}
              >
                {entry.name}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <div className="engine-part-detail" aria-live="polite">
            <span>IN FOCUS</span>
            <h4>{part.name}</h4>
            <p>{part.detail}</p>
          </div>
        </div>
      </div>
      <div
        className="engine-stroke-tabs"
        role="group"
        aria-label="Four stroke cycle"
      >
        {strokes.map((entry, index) => (
          <button
            key={entry.name}
            type="button"
            aria-pressed={step === index}
            onClick={() => {
              setPlaying(false);
              setStep(index);
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {entry.name}
          </button>
        ))}
      </div>
      <div
        className="engine-stroke-detail"
        aria-live={playing ? "off" : "polite"}
      >
        <strong>{stroke.motion}</strong>
        <p>{stroke.detail}</p>
        <span>One full cycle = two crankshaft revolutions.</span>
      </div>
      <p className="engine-accuracy-note">
        A teaching schematic of a spark-ignition engine. Motion and timing are
        simplified, not a mechanically accurate simulation. Explore a detailed
        3D assembly in the model library below.
      </p>
    </section>
  );
}
