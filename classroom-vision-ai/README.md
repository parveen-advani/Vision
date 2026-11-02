# Vision — Teaching Studio

An interactive classroom workspace for exploring educational 3D models with
voice commands, hand gestures, and direct controls. Present a model, explain its
parts, and give the class a different perspective.

## The teaching workspace

- Find any of the eight models in the searchable library, or filter by subject.
- Drag the model to rotate it. The toolbar controls zoom, animation, and separated parts.
- Use **Voice commands** to speak or type, or click one of the suggested commands.
- Start **Gesture control** when you want to use hand movements. The gesture guide explains each action.
- Choose **Present lesson** for a focused classroom display; press Escape to return.
- Press `?` to see keyboard shortcuts. Shortcuts pause while you type or focus a control.
- Lesson notes explain the current model, and **Session history** keeps recent actions within reach.

The interface includes a responsive model drawer, keyboard focus management,
reduced-motion support, and locally served DM Sans fonts. Font licensing is in
`public/fonts/OFL.txt`.

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

### Windows launchers for this checkout

From the parent `Vision` folder, double-click `start-vision.cmd` to start the
frontend and FastAPI backend and open `http://127.0.0.1:5173`. Double-click
`stop-vision.cmd` to stop the local services. Running the start launcher again
reuses this project's existing services.

The launchers use the installed frontend dependencies and `backend/.venv`.
Local frontend configuration is in `.env.development.local`, with
`VITE_AI_API_URL=http://127.0.0.1:8000`. No OpenAI API key is required for the
built-in command parser. Service logs are in the parent `.local-run` folder.

Click **Start Camera** or **Start Listening** in the browser to enable those
features and grant permissions. Manual commands work without camera or
microphone access.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

The repository root now contains `vercel.json` and an API entry point, so the
existing Vercel project can keep its Root Directory at the repository root.
The versioned configuration installs the nested app with `npm ci`, builds it,
and publishes only `classroom-vision-ai/dist`. `/api/interpret` runs as a Vercel
Function using the shared handler in this folder.

Push source changes to the project's connected production branch to deploy.
Do not deploy the repository files as an unbuilt static directory.

If creating a separate Vercel project with Root Directory set to
`classroom-vision-ai`, use Framework `Vite`, Build Command `npm run build`,
Output Directory `dist`, and Install Command `npm ci`.

Leave `VITE_AI_API_URL` unset on Vercel so commands use the same-origin
`/api/interpret` function. The optional local FastAPI URL belongs only in
`.env.development.local` and must not be bundled into a production build.

Add environment variables only if you want optional OpenAI interpretation:

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

Then create `.env.development.local` in the project root:

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
