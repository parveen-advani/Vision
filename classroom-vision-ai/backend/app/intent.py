import os
import re
import httpx
from .library import VISUAL_LIBRARY
from .models import IntentResult

ACTIONS = [
    ('next', [r'\bnext\b', r'forward'], 'Moving to the next classroom visual.'),
    ('previous', [r'previous', r'\bback\b'], 'Going back to the previous classroom visual.'),
    ('rotate-left', [r'rotate left', r'turn left'], 'Rotating the model left.'),
    ('rotate-right', [r'rotate right', r'turn right'], 'Rotating the model right.'),
    ('rotate-up', [r'rotate up', r'tilt up', r'top view'], 'Tilting the model upward.'),
    ('rotate-down', [r'rotate down', r'tilt down', r'bottom view'], 'Tilting the model downward.'),
    ('zoom-in', [r'zoom in', r'closer', r'bigger', r'enlarge'], 'Zooming in.'),
    ('zoom-out', [r'zoom out', r'smaller', r'wide view'], 'Zooming out.'),
    ('reset', [r'reset', r'default view', r'normal view'], 'Resetting the board.'),
    ('explode', [r'explode', r'separate', r'show parts', r'break down'], 'Separating parts for explanation.'),
    ('projector', [r'projector mode', r'full screen', r'presentation mode'], 'Toggling projector mode.'),
    ('pause', [r'pause', r'stop rotation', r'hold'], 'Pausing the motion.'),
    ('resume', [r'resume', r'continue', r'play', r'start rotation'], 'Resuming the motion.'),
]


def normalize(text: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9\s-]', ' ', text.lower())).strip()


def parse_local(transcript: str) -> IntentResult:
    normalized = normalize(transcript)
    best_visual = None
    best_score = 0
    best_keywords: list[str] = []

    for visual in VISUAL_LIBRARY:
        score = 0
        hits: list[str] = []
        for keyword in visual['keywords']:
            key = normalize(keyword)
            if key and key in normalized:
                score += 4 if ' ' in key else 2
                hits.append(keyword)
        if score > best_score:
            best_visual = visual
            best_score = score
            best_keywords = hits

    action = 'show' if best_visual else 'none'
    response = 'Loading the requested classroom visual.' if best_visual else 'No classroom command detected.'

    for candidate_action, patterns, candidate_response in ACTIONS:
        if any(re.search(pattern, normalized) for pattern in patterns):
            action = candidate_action
            response = candidate_response
            break

    visual_id = best_visual['id'] if best_visual else None
    if visual_id and action == 'show':
        response = f"Showing {best_visual['shortTitle']} on the smart board."

    confidence = min(0.98, 0.62 + best_score / 15) if best_score else (0.25 if action == 'none' else 0.82)
    return IntentResult(
        visualId=visual_id,
        action=action,
        confidence=confidence,
        transcript=transcript,
        response=response,
        keywords=best_keywords,
        source='api',
    )


async def parse_with_openai(transcript: str) -> IntentResult | None:
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return None

    local = parse_local(transcript)
    model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
    allowed_visuals = ', '.join(visual['id'] for visual in VISUAL_LIBRARY)
    allowed_actions = ', '.join([item[0] for item in ACTIONS] + ['show', 'focus', 'none'])

    payload = {
        'model': model,
        'temperature': 0,
        'response_format': {'type': 'json_object'},
        'messages': [
            {
                'role': 'system',
                'content': (
                    f'Return JSON for a classroom command. Allowed visualId values: {allowed_visuals}. '
                    f'Allowed actions: {allowed_actions}. JSON keys: visualId, action, confidence, response, keywords.'
                ),
            },
            {'role': 'user', 'content': transcript},
        ],
    }

    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=payload,
        )
    if response.status_code >= 400:
        return None

    content = response.json().get('choices', [{}])[0].get('message', {}).get('content')
    if not content:
        return None

    try:
        data = httpx.Response(200, content=content).json()
        return IntentResult(**{**local.model_dump(), **data, 'transcript': transcript, 'source': 'ai'})
    except Exception:
        return None
