import { visualLibrary } from '../data/visualLibrary';
import type { CommandAction, IntentResult, VisualId } from '../types';

const ACTION_PATTERNS: Array<{ action: CommandAction; patterns: RegExp[]; response: string }> = [
  {
    action: 'next',
    patterns: [/\bnext\b/, /\bnext model\b/, /\bnext diagram\b/, /\bforward\b/],
    response: 'Moving to the next classroom visual.',
  },
  {
    action: 'previous',
    patterns: [/\bprevious\b/, /\bback\b/, /\blast model\b/],
    response: 'Going back to the previous visual.',
  },
  {
    action: 'rotate-left',
    patterns: [/rotate left/, /turn left/, /left side/],
    response: 'Rotating the model left.',
  },
  {
    action: 'rotate-right',
    patterns: [/rotate right/, /turn right/, /right side/],
    response: 'Rotating the model right.',
  },
  {
    action: 'rotate-up',
    patterns: [/rotate up/, /tilt up/, /top view/],
    response: 'Tilting the model upward.',
  },
  {
    action: 'rotate-down',
    patterns: [/rotate down/, /tilt down/, /bottom view/],
    response: 'Tilting the model downward.',
  },
  {
    action: 'zoom-in',
    patterns: [/zoom in/, /come closer/, /make it bigger/, /enlarge/],
    response: 'Zooming in for a closer explanation.',
  },
  {
    action: 'zoom-out',
    patterns: [/zoom out/, /go back/, /make it smaller/, /wide view/],
    response: 'Zooming out to the full classroom view.',
  },
  {
    action: 'reset',
    patterns: [/reset/, /start again/, /normal view/, /default view/, /restore/],
    response: 'Resetting the 3D board.',
  },
  {
    action: 'explode',
    patterns: [/explode/, /separate/, /break down/, /open layers/, /show parts/, /parts view/],
    response: 'Separating the model into teaching parts.',
  },
  {
    action: 'focus',
    patterns: [/focus/, /highlight/, /point to/, /show detail/],
    response: 'Focusing the classroom highlight.',
  },
  {
    action: 'projector',
    patterns: [/projector mode/, /full screen/, /presentation mode/, /smart board/],
    response: 'Switching projector presentation mode.',
  },
  {
    action: 'pause',
    patterns: [/pause/, /stop rotation/, /hold/],
    response: 'Pausing motion so the class can observe.',
  },
  {
    action: 'resume',
    patterns: [/resume/, /continue/, /start rotation/, /play/],
    response: 'Resuming the animated teaching view.',
  },
];

const SHOW_PATTERNS = [/\bshow\b/, /\bdisplay\b/, /\bopen\b/, /\bdraw\b/, /\bexplain\b/, /\bbring\b/, /\bload\b/];

export function normalizeTranscript(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreVisual(normalized: string): { visualId?: VisualId; score: number; keywords: string[] } {
  let best: { visualId?: VisualId; score: number; keywords: string[] } = { score: 0, keywords: [] };

  for (const visual of visualLibrary) {
    const matched: string[] = [];
    let score = 0;

    for (const keyword of visual.keywords) {
      const normalizedKeyword = normalizeTranscript(keyword);
      if (!normalizedKeyword) continue;
      if (normalized.includes(normalizedKeyword)) {
        matched.push(keyword);
        score += normalizedKeyword.includes(' ') ? 4 : 2;
      }
    }

    if (visual.title.toLowerCase().includes(normalized) && normalized.length > 3) {
      score += 2;
    }

    if (score > best.score) {
      best = { visualId: visual.id, score, keywords: matched };
    }
  }

  return best;
}

function detectAction(normalized: string, hasVisual: boolean): { action: CommandAction; response: string; actionScore: number } {
  for (const item of ACTION_PATTERNS) {
    if (item.patterns.some((pattern) => pattern.test(normalized))) {
      return { action: item.action, response: item.response, actionScore: 0.88 };
    }
  }

  if (hasVisual && SHOW_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      action: 'show',
      response: 'Loading the requested classroom visual.',
      actionScore: 0.9,
    };
  }

  if (hasVisual) {
    return {
      action: 'show',
      response: 'I detected a teaching topic and loaded the matching visual.',
      actionScore: 0.75,
    };
  }

  return {
    action: 'none',
    response: 'I did not detect a model command yet. Try saying “show human heart” or “show OSI model”.',
    actionScore: 0.2,
  };
}

export function interpretLocally(transcript: string): IntentResult {
  const normalized = normalizeTranscript(transcript);
  const visual = scoreVisual(normalized);
  const action = detectAction(normalized, Boolean(visual.visualId));
  const confidence = Math.min(0.98, Math.max(action.actionScore, visual.score ? 0.55 + visual.score / 15 : 0.25));

  const visualTitle = visual.visualId
    ? visualLibrary.find((item) => item.id === visual.visualId)?.shortTitle
    : undefined;

  let response = action.response;
  if (action.action === 'show' && visualTitle) {
    response = `Showing ${visualTitle} on the smart board.`;
  }

  return {
    visualId: visual.visualId,
    action: action.action,
    confidence,
    transcript,
    response,
    keywords: visual.keywords,
    source: 'local',
  };
}

export async function interpretWithApi(transcript: string, signal?: AbortSignal): Promise<IntentResult> {
  const base = import.meta.env.VITE_AI_API_URL?.replace(/\/$/, '') ?? '';
  const endpoint = base ? `${base}/api/interpret` : '/api/interpret';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as Partial<IntentResult>;
    return {
      ...interpretLocally(transcript),
      ...data,
      transcript,
      source: data.source ?? 'api',
    };
  } catch {
    return interpretLocally(transcript);
  }
}
