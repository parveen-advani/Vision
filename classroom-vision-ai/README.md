# Classroom Vision AI

A full-stack proof-of-concept for a Jarvis-style classroom assistant. It listens to a teacher, tracks hand gestures through the laptop camera, and updates a projector-ready 3D teaching board automatically.

## What is included

- React + Vite + TypeScript frontend
- Real-time 3D board using React Three Fiber and Three.js
- MediaPipe hand tracking from the browser camera
- Web Speech API voice commands with manual command fallback
- Built-in local intent parser for offline/demo use
- Vercel serverless API route at `api/interpret.ts`
- Optional FastAPI backend in `backend/`
- 8 classroom visuals: Human Heart, OSI Model, DNA, Solar System, Atom, Plant Cell, Neural Network, Water Cycle
- Projector Mode for classroom/smart-board display
- Keyboard, button, voice, and gesture controls

## Core teacher commands

Try these in the microphone or manual command box:

```text
Show human heart
Show OSI model
Show DNA double helix
Show solar system
Show atom
Show plant cell
Show neural network
Show water cycle
Zoom in
Zoom out
Rotate left
Rotate right
Explode parts
Reset view
Projector mode
Pause rotation
Resume rotation
```

## Gesture controls

| Gesture | Action |
| --- | --- |
| Open palm | Rotate the 3D model by moving your hand |
| Pinch | Zoom emphasis |
| Point | Projector spotlight follows your finger |
| Fist | Reset model view |
| Swipe right | Next model |
| Swipe left | Previous model |

## Run frontend locally

```bash
npm install
npm run dev
```

Open the URL shown by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push this folder to GitHub or import the ZIP into Vercel.
2. Framework preset: `Vite`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables only if you want optional OpenAI interpretation:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

The app still works without OpenAI because local keyword-based intent parsing is built in.

## Optional FastAPI backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then create `.env.local` in the project root:

```bash
VITE_AI_API_URL=http://localhost:8000
```

Run the frontend again with `npm run dev`.

## Important browser notes

- Camera and microphone permissions work on `localhost` during development and require HTTPS in production.
- Browser speech recognition support varies by browser. If voice recognition is unavailable, use the manual command box.
- MediaPipe hand tracking downloads its WASM/runtime and hand model from official/CDN URLs at runtime. Keep the device online for the first load.
- The 3D models are educational concept models built from Three.js primitives, so they are lightweight and deployable without large asset files.

## Suggested classroom setup

1. Connect laptop to projector or smart board.
2. Open the app in Chrome.
3. Click `Start Listening` and `Start Camera`.
4. Stand in front of the laptop camera.
5. Say “Show human heart” or “Show OSI model”.
6. Use open palm, pinch, point, fist, and swipe gestures to control the 3D board.

## Project structure

```text
classroom-vision-ai/
├── api/interpret.ts              # Vercel serverless command parser
├── backend/                      # Optional FastAPI backend
├── public/                       # Static public files
├── src/
│   ├── components/               # UI and 3D presentation components
│   ├── data/visualLibrary.ts     # Educational model library
│   ├── hooks/                    # Speech and hand tracking hooks
│   ├── utils/                    # Intent and gesture logic
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── vercel.json
├── package.json
└── README.md
```
