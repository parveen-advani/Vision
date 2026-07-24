from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .intent import parse_local, parse_with_openai
from .library import VISUAL_LIBRARY
from .models import InterpretRequest

app = FastAPI(
    title='Classroom Vision AI API',
    version='1.0.0',
    description='Intent parser and realtime control channel for the AI classroom presenter.',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'classroom-vision-ai'}

@app.get('/api/library')
def library():
    return {'items': VISUAL_LIBRARY}

@app.post('/api/interpret')
async def interpret(payload: InterpretRequest):
    ai_result = await parse_with_openai(payload.transcript)
    return ai_result or parse_local(payload.transcript)

@app.websocket('/ws/control')
async def websocket_control(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            message = await websocket.receive_json()
            transcript = str(message.get('transcript', ''))
            if transcript.strip():
                result = parse_local(transcript)
                await websocket.send_json(result.model_dump())
            else:
                await websocket.send_json({'error': 'Send {"transcript":"show heart"}'})
    except WebSocketDisconnect:
        return
