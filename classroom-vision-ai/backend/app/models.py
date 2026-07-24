from typing import Literal
from pydantic import BaseModel, Field

VisualId = Literal['heart', 'osi', 'dna', 'solar', 'atom', 'cell', 'neural', 'waterCycle']
CommandAction = Literal[
    'show', 'rotate-left', 'rotate-right', 'rotate-up', 'rotate-down', 'zoom-in', 'zoom-out',
    'reset', 'next', 'previous', 'explode', 'focus', 'projector', 'pause', 'resume', 'none'
]

class InterpretRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=2000)

class IntentResult(BaseModel):
    visualId: VisualId | None = None
    action: CommandAction
    confidence: float = Field(ge=0, le=1)
    transcript: str
    response: str
    keywords: list[str] = []
    source: Literal['local', 'api', 'ai'] = 'api'
