import { visualLibrary } from '../src/data/visualLibrary.js';
import type { CommandAction, IntentResult, VisualId } from '../src/types.js';

type RequestLike = {
  method?: string;
  body?: unknown;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(data: unknown): void;
    end?(body?: string): void;
  };
};

const ACTIONS: Array<{ action: CommandAction; patterns: RegExp[]; response: string }> = [
  { action: 'next', patterns: [/\bnext\b/, /forward/], response: 'Moving to the next classroom visual.' },
  { action: 'previous', patterns: [/previous/, /\bback\b/], response: 'Going back to the previous classroom visual.' },
  { action: 'rotate-left', patterns: [/rotate left/, /turn left/], response: 'Rotating the model left.' },
  { action: 'rotate-right', patterns: [/rotate right/, /turn right/], response: 'Rotating the model right.' },
  { action: 'rotate-up', patterns: [/rotate up/, /tilt up/, /top view/], response: 'Tilting the model upward.' },
  { action: 'rotate-down', patterns: [/rotate down/, /tilt down/, /bottom view/], response: 'Tilting the model downward.' },
  { action: 'zoom-in', patterns: [/zoom in/, /closer/, /bigger/, /enlarge/], response: 'Zooming in.' },
  { action: 'zoom-out', patterns: [/zoom out/, /smaller/, /wide view/], response: 'Zooming out.' },
  { action: 'reset', patterns: [/reset/, /default view/, /normal view/], response: 'Resetting the board.' },
  { action: 'explode', patterns: [/explode/, /separate/, /show parts/, /break down/], response: 'Separating parts for explanation.' },
  { action: 'projector', patterns: [/projector mode/, /full screen/, /presentation mode/], response: 'Toggling projector mode.' },
  { action: 'pause', patterns: [/pause/, /stop rotation/, /hold/], response: 'Pausing the motion.' },
  { action: 'resume', patterns: [/resume/, /continue/, /play/, /start rotation/], response: 'Resuming the motion.' },
];

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseLocal(transcript: string): IntentResult {
  const normalized = normalize(transcript);
  let visualId: VisualId | undefined;
  let bestScore = 0;
  let keywords: string[] = [];

  for (const visual of visualLibrary) {
    let score = 0;
    const hits: string[] = [];
    for (const keyword of visual.keywords) {
      const key = normalize(keyword);
      if (key && normalized.includes(key)) {
        score += key.includes(' ') ? 4 : 2;
        hits.push(keyword);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      visualId = visual.id;
      keywords = hits;
    }
  }

  let action: CommandAction = visualId ? 'show' : 'none';
  let response = visualId ? 'Loading the requested classroom visual.' : 'No classroom command detected.';

  for (const candidate of ACTIONS) {
    if (candidate.patterns.some((pattern) => pattern.test(normalized))) {
      action = candidate.action;
      response = candidate.response;
      break;
    }
  }

  if (visualId && action === 'show') {
    const title = visualLibrary.find((item) => item.id === visualId)?.shortTitle ?? 'visual';
    response = `Showing ${title} on the smart board.`;
  }

  return {
    visualId,
    action,
    transcript,
    confidence: Math.min(0.98, bestScore ? 0.62 + bestScore / 15 : action === 'none' ? 0.25 : 0.82),
    response,
    keywords,
    source: 'api',
  };
}

async function parseWithOpenAI(transcript: string): Promise<IntentResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const allowedVisuals = visualLibrary.map((item) => item.id).join(', ');
  const allowedActions = ACTIONS.map((item) => item.action).concat(['show', 'focus', 'none']).join(', ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `Return JSON for a classroom command. Allowed visualId values: ${allowedVisuals}. Allowed actions: ${allowedActions}. ` +
            'Use action show when the teacher asks for a visual. Use none only when no teaching command exists. JSON keys: visualId, action, confidence, response, keywords.',
        },
        { role: 'user', content: transcript },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Partial<IntentResult>;
    return {
      ...parseLocal(transcript),
      ...parsed,
      transcript,
      source: 'ai',
    } as IntentResult;
  } catch {
    return null;
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end?.();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as { transcript?: string } | undefined);
  const transcript = body?.transcript?.toString() ?? '';

  if (!transcript.trim()) {
    res.status(400).json({ error: 'Missing transcript' });
    return;
  }

  const ai = await parseWithOpenAI(transcript).catch(() => null);
  res.status(200).json(ai ?? parseLocal(transcript));
}
