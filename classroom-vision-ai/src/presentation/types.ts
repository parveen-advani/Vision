import type { VisualId } from "../types";

export type Audience = "general" | "students" | "executives" | "technical";
export type PresentationLanguage = "en" | "hi" | "hinglish";
export interface SessionContext {
  topic: string;
  audience: Audience;
  language: PresentationLanguage;
  detail: "brief" | "balanced" | "deep";
  notes: string;
  documentName: string;
}
export interface SessionTurn {
  id: string;
  role: "presenter" | "audience";
  text: string;
  at: string;
}
export type VisualKind =
  | "model"
  | "engine"
  | "flow"
  | "comparison"
  | "chart"
  | "explanation";
export interface VisualPlan {
  title: string;
  takeaway: string;
  explanation: string;
  analogy: string;
  kind: VisualKind;
  modelId: VisualId | null;
  externalQuery: string;
  steps: Array<{ title: string; detail: string }>;
  comparison: Array<{ heading: string; points: string[] }>;
  metrics: Array<{ label: string; value: number; unit: string }>;
  keyPoints: string[];
  followUps: string[];
  citations: Array<{ title: string; url: string }>;
  caveat: string;
}
export interface CopilotRequest {
  message: string;
  trigger: "ask" | "speech" | "simplify" | "deeper";
  context: SessionContext;
  transcript: SessionTurn[];
  currentPlan: Pick<VisualPlan, "title" | "takeaway" | "kind"> | null;
  webResearch: boolean;
}
export interface CopilotResponse {
  plan: VisualPlan;
  source: "ai" | "guide";
  aiConfigured: boolean;
  notice: string;
  webSearched: boolean;
}
export interface SessionCard extends CopilotResponse {
  id: string;
  question: string;
  createdAt: string;
}
export interface ExternalModel {
  uid: string;
  title: string;
  author: string;
  authorUrl: string;
  url: string;
  thumbnail: string;
  license: string;
  animated: boolean;
}
export const defaultSessionContext: SessionContext = {
  topic: "",
  audience: "general",
  language: "en",
  detail: "balanced",
  notes: "",
  documentName: "",
};
