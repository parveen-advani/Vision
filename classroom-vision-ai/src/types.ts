export type VisualId =
  | "heart"
  | "osi"
  | "dna"
  | "solar"
  | "atom"
  | "cell"
  | "neural"
  | "waterCycle";

export type VisualCategory =
  | "biology"
  | "computer-science"
  | "physics"
  | "earth-science";

export interface VisualEntry {
  id: VisualId;
  title: string;
  shortTitle: string;
  category: VisualCategory;
  subtitle: string;
  keywords: string[];
  explanation: string;
  teacherPrompts: string[];
  layers?: string[];
}

export type CommandAction =
  | "show"
  | "rotate-left"
  | "rotate-right"
  | "rotate-up"
  | "rotate-down"
  | "zoom-in"
  | "zoom-out"
  | "reset"
  | "next"
  | "previous"
  | "explode"
  | "focus"
  | "projector"
  | "pause"
  | "resume"
  | "none";

export interface IntentResult {
  visualId?: VisualId;
  action: CommandAction;
  confidence: number;
  transcript: string;
  response: string;
  keywords: string[];
  source: "local" | "api" | "ai";
}

export type GestureName =
  | "idle"
  | "open-palm"
  | "point"
  | "pinch"
  | "fist"
  | "thumbs-up"
  | "swipe-left"
  | "swipe-right"
  | "two-hands"
  | "unknown";

export interface GestureState {
  name: GestureName;
  confidence: number;
  x: number;
  y: number;
  z: number;
  pinchDistance: number;
  active: boolean;
  message: string;
  timestamp: number;
}

export interface GestureEvent {
  id: number;
  name: GestureName;
  message: string;
  timestamp: number;
}

export interface ModelTransform {
  rotationX: number;
  rotationY: number;
  zoom: number;
  exploded: boolean;
  paused: boolean;
}

export interface CommandLogItem {
  id: number;
  at: string;
  transcript: string;
  action: string;
  visualTitle: string;
  confidence: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
