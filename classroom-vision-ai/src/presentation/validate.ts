import type { VisualId } from "../types.js";
import type { VisualKind, VisualPlan } from "./types.js";

export const visualIds: VisualId[] = [
  "heart",
  "osi",
  "dna",
  "solar",
  "atom",
  "cell",
  "neural",
  "waterCycle",
];
export const visualKinds: VisualKind[] = [
  "model",
  "engine",
  "flow",
  "comparison",
  "chart",
  "explanation",
];

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function texts(
  value: unknown,
  maxItems: number,
  maxLength: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => text(item, maxLength))
  );
}

export function safeCitationUrl(value: unknown): string | null {
  if (!text(value, 2048)) return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (
      !url.hostname.includes(".") ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)
    )
      return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Runtime boundary shared by the browser and server; no server dependencies. */
export function validatePlan(value: unknown): VisualPlan | null {
  if (
    !object(value) ||
    !text(value.title, 180) ||
    !value.title.trim() ||
    !text(value.takeaway, 600) ||
    !text(value.explanation, 6000) ||
    !text(value.analogy, 1200) ||
    !text(value.externalQuery, 200) ||
    !text(value.caveat, 1800) ||
    !visualKinds.includes(value.kind as VisualKind) ||
    !(
      value.modelId === null || visualIds.includes(value.modelId as VisualId)
    ) ||
    !texts(value.keyPoints, 12, 1000) ||
    !texts(value.followUps, 6, 240)
  )
    return null;
  if (value.kind === "model" && value.modelId === null) return null;
  if (
    !Array.isArray(value.steps) ||
    value.steps.length > 8 ||
    !value.steps.every(
      (item) =>
        object(item) && text(item.title, 180) && text(item.detail, 1800),
    )
  )
    return null;
  if (
    !Array.isArray(value.comparison) ||
    value.comparison.length > 4 ||
    !value.comparison.every(
      (item) =>
        object(item) && text(item.heading, 180) && texts(item.points, 8, 1000),
    )
  )
    return null;
  if (
    !Array.isArray(value.metrics) ||
    value.metrics.length > 12 ||
    !value.metrics.every(
      (item) =>
        object(item) &&
        text(item.label, 160) &&
        typeof item.value === "number" &&
        Number.isFinite(item.value) &&
        Math.abs(item.value) <= 1e15 &&
        text(item.unit, 40),
    )
  )
    return null;
  if (value.kind === "flow" && value.steps.length < 1) return null;
  if (value.kind === "comparison" && value.comparison.length < 2) return null;
  if (value.kind === "chart" && value.metrics.length < 1) return null;
  if (
    !Array.isArray(value.citations) ||
    value.citations.length > 8 ||
    !value.citations.every(
      (item) =>
        object(item) && text(item.title, 300) && safeCitationUrl(item.url),
    )
  )
    return null;

  return {
    title: value.title,
    takeaway: value.takeaway,
    explanation: value.explanation,
    analogy: value.analogy,
    kind: value.kind as VisualKind,
    modelId: value.modelId as VisualId | null,
    externalQuery: value.externalQuery,
    steps: value.steps.map((item) => ({
      title: item.title as string,
      detail: item.detail as string,
    })),
    comparison: value.comparison.map((item) => ({
      heading: item.heading as string,
      points: [...(item.points as string[])],
    })),
    metrics: value.metrics.map((item) => ({
      label: item.label as string,
      value: item.value as number,
      unit: item.unit as string,
    })),
    keyPoints: [...value.keyPoints],
    followUps: [...value.followUps],
    citations: value.citations.map((item) => ({
      title: item.title as string,
      url: safeCitationUrl(item.url)!,
    })),
    caveat: value.caveat,
  };
}
