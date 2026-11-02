import { visualLibrary } from "../data/visualLibrary.js";
import type { VisualId } from "../types.js";
import type { CopilotRequest, CopilotResponse, VisualPlan } from "./types.js";

type GuideId = VisualId | "engine" | "gross-margin" | "cash-profit";
const normalize = (value: string) =>
  value.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
const emptyPlan = (): VisualPlan => ({
  title: "",
  takeaway: "",
  explanation: "",
  analogy: "",
  kind: "explanation",
  modelId: null,
  externalQuery: "",
  steps: [],
  comparison: [],
  metrics: [],
  keyPoints: [],
  followUps: [],
  citations: [],
  caveat: "",
});
const unsupportedEngine = (value: string) =>
  /\b(?:diesel|two stroke|2 stroke|jet|turbine|steam|electric|rocket|wankel|rotary|search|game)\b/.test(
    normalize(value),
  ) && /\b(?:engine|motor|combustion|piston)\b/.test(normalize(value));

function identify(value: string): GuideId | null {
  const input = normalize(value);
  if (
    /\bgross\s+(?:profit\s+)?margin\b|\bcogs\b|\bcost of goods sold\b/.test(
      input,
    )
  )
    return "gross-margin";
  if (/\bcash\s*flow\b|\bprofit\b.*\bcash\b|\bcash\b.*\bprofit\b/.test(input))
    return "cash-profit";
  if (unsupportedEngine(input)) return null;
  if (
    /\b(?:four stroke|4 stroke|combustion|piston|crankshaft|petrol engine)\b/.test(
      input,
    ) ||
    (/\bengine\b/.test(input) &&
      !/\bsearch engine\b|\bgame engine\b/.test(input))
  )
    return "engine";
  const aliases: Array<[VisualId, RegExp]> = [
    ["heart", /\bheart\b|\bcardiac\b|\bblood circulation\b/],
    ["osi", /\bosi\b|\bseven layers\b|\bnetwork layers\b/],
    ["dna", /\bdna\b|\bdouble helix\b|\bgenetic instructions\b/],
    ["solar", /\bsolar system\b|\bplanetary orbits\b|\bplanets\b/],
    ["atom", /\batom\b|\batomic\b|\belectrons\b/],
    ["cell", /\bplant cell\b|\bchloroplast\b|\bcell wall\b/],
    ["neural", /\bneural network\b|\bmachine learning\b|\bhidden layers\b/],
    ["waterCycle", /\bwater cycle\b|\bevaporation\b|\bcondensation\b/],
  ];
  return aliases.find(([, pattern]) => pattern.test(input))?.[0] ?? null;
}

function resolveGuide(request: CopilotRequest): GuideId | null {
  if (unsupportedEngine(request.message)) return null;
  const direct = identify(request.message);
  if (direct) return direct;
  const followUp =
    request.trigger === "simplify" ||
    request.trigger === "deeper" ||
    (request.message.length < 200 &&
      /\b(this|that|it|its|those|same|continue|again|simpler|deeper|example|more|isko|ise|yeh|aur)\b/i.test(
        request.message,
      )) ||
    /^(?:please )?(?:explain|help|continue|simplify)[.!? ]*$/i.test(
      request.message,
    );
  if (!followUp) return null;
  const candidates = [
    request.currentPlan
      ? request.currentPlan.title + " " + request.currentPlan.takeaway
      : "",
    ...request.transcript
      .slice(-12)
      .reverse()
      .map((turn) => turn.text),
    request.context.topic,
  ];
  for (const candidate of candidates) {
    const match = identify(candidate);
    if (match) return match;
  }
  return null;
}

function enginePlan(): VisualPlan {
  return {
    ...emptyPlan(),
    title: "How a four-stroke engine works",
    kind: "engine",
    takeaway:
      "Four piston strokes turn fuel energy into a rotating crankshaft.",
    explanation:
      "In a simplified spark-ignition engine, a piston draws in an air–fuel mixture, compresses it, receives a push from combustion, and expels exhaust. The connecting rod turns this up-and-down movement into crankshaft rotation. One cycle takes two crankshaft revolutions.",
    analogy:
      "Think of a bicycle pedal: repeated pushes become continuous rotation. The crankshaft plays a similar connecting role.",
    externalQuery: "four stroke internal combustion engine cutaway",
    steps: [
      {
        title: "1. Intake",
        detail:
          "The intake valve opens and the piston moves down, drawing the mixture into the cylinder.",
      },
      {
        title: "2. Compression",
        detail:
          "Both valves close. The piston moves up and compresses the mixture.",
      },
      {
        title: "3. Power",
        detail:
          "A spark ignites the compressed mixture. Expanding gases push the piston down.",
      },
      {
        title: "4. Exhaust",
        detail:
          "The exhaust valve opens. The piston moves up and pushes the spent gases out.",
      },
    ],
    keyPoints: [
      "The power stroke supplies useful force.",
      "The crankshaft links all four strokes into a repeating cycle.",
      "Valves control when gases enter and leave the cylinder.",
    ],
    followUps: [
      "Explain that more simply",
      "Go deeper into the engine cycle",
      "Show a cutaway engine model",
    ],
    caveat:
      "Built-in educational guide for a simplified four-stroke spark-ignition engine. Diesel ignition, valve timing, losses, and detailed engineering are not represented.",
  };
}

function explicitAmount(input: string, labels: string): number | null {
  const pattern = new RegExp(
    "\\b(?:" +
      labels +
      ")\\s*(?:is|was|of|=|:)?\\s*(?:USD|INR|EUR|Rs\\.?|[$₹€])?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(billion|million|lakh|crore|thousand|bn|k|m)?\\b",
    "i",
  );
  const match = input.match(pattern);
  if (!match) return null;
  const scale: Record<string, number> = {
    billion: 1e9,
    million: 1e6,
    lakh: 1e5,
    crore: 1e7,
    thousand: 1e3,
    bn: 1e9,
    k: 1e3,
    m: 1e6,
  };
  const result =
    Number(match[1].replace(/,/g, "")) * (scale[match[2]?.toLowerCase()] ?? 1);
  return Number.isFinite(result) && result >= 0 && result <= 1e12
    ? result
    : null;
}

function marginPlan(request: CopilotRequest): VisualPlan {
  const supplied = request.message + "\n" + request.context.notes;
  const suppliedRevenue = explicitAmount(supplied, "revenue|sales");
  const suppliedCost = explicitAmount(
    supplied,
    "cogs|cost of goods sold|direct costs",
  );
  const useSupplied =
    suppliedRevenue !== null && suppliedRevenue > 0 && suppliedCost !== null;
  const revenue = useSupplied ? suppliedRevenue : 100;
  const cost = useSupplied ? suppliedCost : 60;
  const profit = revenue - cost;
  const margin = Math.round((profit / revenue) * 10000) / 100;
  return {
    ...emptyPlan(),
    title: "Gross margin: what remains after direct costs",
    kind: "chart",
    takeaway: `${useSupplied ? "From your labelled inputs" : "Illustrative example"}: gross margin is ${margin}%.`,
    explanation: `Gross profit is revenue minus cost of goods sold. Gross margin divides gross profit by revenue and expresses it as a percentage. Here, (${revenue.toLocaleString("en-US")} − ${cost.toLocaleString("en-US")}) ÷ ${revenue.toLocaleString("en-US")} × 100 = ${margin}%. This is not net profit: operating expenses, interest, and taxes still matter.`,
    analogy:
      "Imagine a shop sells a product for 100 currency units and pays 60 to obtain it. The remaining 40 helps cover the rest of the business.",
    metrics: [
      { label: "Revenue", value: revenue, unit: "units" },
      { label: "Cost of goods sold", value: cost, unit: "units" },
      { label: "Gross profit", value: profit, unit: "units" },
    ],
    steps: [
      {
        title: "Start with revenue",
        detail:
          "Use revenue and cost of goods sold from the same reporting period and currency.",
      },
      {
        title: "Subtract direct costs",
        detail: "Revenue − cost of goods sold = gross profit.",
      },
      {
        title: "Express it as a percentage",
        detail: "Gross profit ÷ revenue × 100 = gross margin.",
      },
    ],
    keyPoints: [
      "Gross margin is a ratio; gross profit is an amount.",
      "Changes can come from pricing, product mix, or direct costs.",
      "Compare like-for-like periods and accounting definitions.",
    ],
    followUps: [
      "Explain the difference between profit and cash flow",
      "Explain that more simply",
      "Calculate gross margin: revenue 250, COGS 150",
    ],
    caveat: useSupplied
      ? "Calculated only from explicitly labelled Revenue/Sales and COGS/Direct costs in your message or notes. Other notes were not analysed. Confirm that both figures use the same currency and reporting period."
      : "The numbers are a labelled teaching example, not company results or a financial forecast. Supply explicit Revenue and COGS values to calculate your own example.",
  };
}

function cashProfitPlan(): VisualPlan {
  return {
    ...emptyPlan(),
    title: "Profit and cash flow tell different stories",
    kind: "comparison",
    takeaway:
      "Profit describes earnings; cash flow describes money moving in and out.",
    explanation:
      "Under accrual accounting, revenue and expenses can be recognised in a different period from the related cash movement. A profitable sale on credit may not bring cash in until a customer pays. Buying equipment can consume cash immediately while its expense is recognised over time.",
    analogy:
      "A signed promise to pay is different from money in your wallet. Both matter, but they answer different questions.",
    comparison: [
      {
        heading: "Profit",
        points: [
          "Revenue minus recognised expenses.",
          "Includes non-cash items such as depreciation.",
          "Useful for understanding earning performance.",
        ],
      },
      {
        heading: "Cash flow",
        points: [
          "Actual cash inflows and outflows.",
          "Affected by collection timing, inventory, investment, and financing.",
          "Useful for understanding liquidity and funding needs.",
        ],
      },
    ],
    steps: [
      {
        title: "Make a sale on credit",
        detail: "Revenue may be recognised before the customer pays.",
      },
      {
        title: "Collect the payment",
        detail: "Cash arrives later; this collection is not a second sale.",
      },
      {
        title: "Connect the statements",
        detail:
          "The cash-flow statement explains movements that a profit figure alone cannot show.",
      },
    ],
    keyPoints: [
      "Profit is not the bank balance.",
      "Working capital can absorb or release cash.",
      "Review operating, investing, and financing cash flows separately.",
    ],
    followUps: [
      "Explain gross margin with an example",
      "Explain that more simply",
      "Go deeper into cash flow versus profit",
    ],
    caveat:
      "Built-in explanation of accrual-accounting concepts. No company accounts, uploaded document, live financial data, or forecast has been analysed.",
  };
}

const modelPoints: Record<VisualId, string[]> = {
  heart: [
    "The right side sends blood toward the lungs.",
    "The left side sends blood toward the body.",
    "Valves help blood flow in one direction.",
  ],
  osi: [
    "Seven conceptual layers separate networking responsibilities.",
    "Application-facing layers sit above transport and network functions.",
    "Lower layers connect data to frames, bits, and physical transmission.",
  ],
  dna: [
    "Two strands form a double helix.",
    "Base pairs connect the strands.",
    "The sequence carries genetic information.",
  ],
  solar: [
    "Planets revolve around the Sun.",
    "A planet’s rotation is different from its revolution.",
    "This illustration does not use true relative sizes or distances.",
  ],
  atom: [
    "The nucleus contains protons and neutrons.",
    "Electrons are associated with quantum states around the nucleus.",
    "Visible orbit tracks are a teaching analogy, not literal electron paths.",
  ],
  cell: [
    "The cell wall provides structural support.",
    "Chloroplasts are involved in photosynthesis.",
    "The nucleus and vacuole have distinct roles.",
  ],
  neural: [
    "Inputs are passed through connected layers.",
    "Weights influence how signals are combined.",
    "Training adjusts model parameters using examples.",
  ],
  waterCycle: [
    "Evaporation moves water toward the atmosphere.",
    "Condensation forms droplets and clouds.",
    "Precipitation and collection return water to the surface.",
  ],
};

function modelPlan(id: VisualId): VisualPlan {
  const visual = visualLibrary.find((item) => item.id === id)!;
  return {
    ...emptyPlan(),
    title: visual.title,
    kind: "model",
    modelId: id,
    takeaway: modelPoints[id][0],
    explanation: visual.explanation,
    keyPoints: modelPoints[id],
    externalQuery: ["osi", "neural", "waterCycle"].includes(id)
      ? ""
      : visual.shortTitle + " educational 3D model",
    steps: modelPoints[id].map((detail, index) => ({
      title: `Explore ${index + 1}`,
      detail,
    })),
    followUps: [
      "Explain that more simply",
      `Go deeper into ${visual.shortTitle}`,
      `Find a detailed ${visual.shortTitle} model`,
    ],
    caveat:
      "Built-in educational explanation with an illustrative model. This response did not analyse uploaded notes or search for current information.",
  };
}

export function makeGuideResponse(
  request: CopilotRequest,
  notice?: string,
): CopilotResponse {
  const guide = resolveGuide(request);
  let plan: VisualPlan;
  if (guide === "engine") plan = enginePlan();
  else if (guide === "gross-margin") plan = marginPlan(request);
  else if (guide === "cash-profit") plan = cashProfitPlan();
  else if (guide) plan = modelPlan(guide);
  else
    plan = {
      ...emptyPlan(),
      title: "This topic needs connected AI",
      takeaway: "A built-in guide cannot reliably answer this request.",
      explanation: `There is no curated guide for “${request.message.slice(0, 220)}”. Connect the server-side AI service for open-ended questions and document-based explanations. You can still explore the built-in engine cycle, gross margin, cash flow, and eight classroom models.`,
      keyPoints: [
        "Your question and session context are retained in the presentation session.",
        "No answer or company data has been invented from your notes.",
      ],
      followUps: [
        "Explain how a four-stroke engine works",
        "Explain gross margin with an example",
        "Explain cash flow versus profit",
      ],
      caveat:
        "No connected AI response or live research was available for this request.",
    };
  if (request.trigger === "simplify" || request.context.detail === "brief") {
    plan = {
      ...plan,
      explanation:
        plan.takeaway +
        " " +
        plan.explanation
          .split(/(?<=[.!?])\s/)
          .slice(0, 2)
          .join(" "),
      keyPoints: plan.keyPoints.slice(0, 3),
    };
  }
  const languageNotice =
    request.context.language !== "en"
      ? " Built-in guides are currently in English; connected AI is needed for Hindi or Hinglish explanations."
      : "";
  const researchNotice = request.webResearch
    ? " Live web research was not performed."
    : "";
  return {
    plan,
    source: "guide",
    aiConfigured: false,
    webSearched: false,
    notice:
      (notice ||
        "Built-in guide. Connected AI is not configured; this is a curated explanation, not an AI-generated answer.") +
      researchNotice +
      languageNotice,
  };
}
