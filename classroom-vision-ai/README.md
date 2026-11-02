# Vision ? Presentation Studio

A live presentation workspace that turns a question or a spoken concept into an
explanation, diagram, comparison, chart, or interactive model. Built for a
professor explaining an engine and a presenter explaining business ideas.

## Use the studio

1. Open **Session brief** and add a topic, audience, language, and detail level.
   Add notes, or import a PPTX, PDF, TXT, or Markdown file. Review the extracted
   text before choosing **Use notes**.
2. Type an **Audience question** or **Presenter prompt**, or choose **Listen to
   the presentation**. Ordinary narration is retained as context; exact model
   commands such as ?rotate left? still work on the built-in model board.
3. Review the proposed explanation, then choose **Show on board**. Suggestion
   mode is the default. **Show visuals automatically** is an explicit opt-in.
4. Explore the engine's selectable parts and four strokes, or open its detailed
   animated Sketchfab assembly. Related models are suggested for physical topics;
   the searchable external library opens selected models on the main board.
5. Use **Make it simpler**, **Go deeper**, or a follow-up question. Session visuals
   let you return to previous explanations. **Present** hides presenter tools;
   Escape returns to the studio. External viewers retain their state.
6. **Export session** downloads Markdown containing shown explanations, source
   links and retained conversation. **New session** clears the tab's session.

Connected AI uses the topic, notes, audience, language, current board and recent
conversation. It supports English, Hindi and Hinglish. Browser voice recognition
uses English (India) or Hindi (India); mixed-language recognition depends on the
browser. Voice is opt-in and typed questions work without microphone access.

Without an API key, the app clearly shows **Guide mode**: the prepared engine,
gross-margin, cash-flow and eight model guides work, but arbitrary questions and
uploaded-note analysis require connected AI. The app does not detect confusion
from audience faces; the presenter or audience supplies a question.

## Documents, models and session limits

- Imports are parsed in the browser. Original files are not uploaded. Only the
  confirmed text notes go to the assistant with a question or spoken request.
- PPTX preserves slide order and speaker-note text. PDF extracts readable text;
  scanned/image-only pages need OCR elsewhere. Slide layouts and animations are
  not reconstructed. Old `.ppt` files must be converted to `.pptx`.
- Import limits: 20 MB, 100 slides/pages, 12,000 note characters. Truncation and
  unreadable text are reported before using the preview.
- This tab retains up to 100 shown visuals and 400 conversation segments in
  memory. Export before closing or resetting. Only the last 12 segments are sent
  as rolling context; use session notes to retain important earlier facts.
- Eight built-in Three.js concept models retain pointer, toolbar, keyboard and
  MediaPipe hand controls. Heavy 3D and document parsers load when needed.
- Sketchfab uses the official hosted viewer with visible creator/license credit.
  Viewer controls and animations depend on the creator's model; universal part
  separation or semantic control of arbitrary models is not claimed.
- Featured assembly: [Rigged 4-Cylinder Engine by david.gnzlv](https://sketchfab.com/3d-models/rigged-4-cylinder-engine-free-e14ebe68273d49a3becda6802270b4b0),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It shows pistons,
  connecting rods and a crankshaft, not the entire engine. Assets are embedded,
  not downloaded or redistributed.

The interface has a responsive model drawer, keyboard focus management,
reduced-motion support and locally served DM Sans fonts. Font licensing is in
`public/fonts/OFL.txt`.

## Core teacher commands

Ask to show a model through the copilot. Exact rotation/zoom commands operate immediately when a built-in 3D model is on the board:

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

Open **Hands-free model controls** to start the camera, or choose **Listen to the presentation** for speech. Each asks for its browser permission only when started.

## Production build

```bash
npm run build
npm run preview
```

Vite preview serves built static files; it does not run Vercel Functions. Use
`npm run dev` for the local API middleware, or deploy to Vercel for a production
end-to-end check.

## Deploy to Vercel

The repository root now contains `vercel.json` and an API entry point, so the
existing Vercel project can keep its Root Directory at the repository root.
The versioned configuration installs the nested app with `npm ci`, builds it,
and publishes only `classroom-vision-ai/dist`. `/api/assistant`, `/api/models` and `/api/interpret` run as Vercel Functions using the shared handlers in this folder.

Push source changes to the project's connected production branch to deploy.
Do not deploy the repository files as an unbuilt static directory.

If creating a separate Vercel project with Root Directory set to
`classroom-vision-ai`, use Framework `Vite`, Build Command `npm run build`,
Output Directory `dist`, and Install Command `npm ci`.

Leave `VITE_AI_API_URL` unset on Vercel so commands use the same-origin
`/api/interpret` function. The optional local FastAPI URL belongs only in
`.env.development.local` and must not be bundled into a production build.

Add server environment variables to enable optional OpenAI features:

```bash
OPENAI_API_KEY=your_key_here
# Existing short command interpreter:
OPENAI_MODEL=gpt-4o-mini
# Contextual presentation copilot:
OPENAI_ASSISTANT_MODEL=gpt-6-luna
VISION_AI_ENABLED=true
```

Add the key as a server-side Secret in Vercel Settings ? Environment Variables, then redeploy. Never paste it into the browser UI or prefix it with `VITE_`. Guide mode and public model search work without an OpenAI key.

## Contextual presentation assistant

`GET /api/assistant` reports whether a server-side AI key is configured, its
provider, and the configured model. This is configuration status, not a successful
provider connectivity check. `POST /api/assistant` accepts the shared
`CopilotRequest` in `src/presentation/types.ts`: a question, session topic,
audience, language, notes, recent transcript, current visual context, and an
optional `webResearch` flag. It returns a validated visual plan and an explicit
`source: "ai"` or `source: "guide"`.

Without a key, or with `VISION_AI_ENABLED=false`, the endpoint returns honest
built-in English guides for the four-stroke spark-ignition engine, gross margin,
cash flow versus profit, and eight classroom models. Generic follow-ups use the
current visual and recent transcript. Unsupported topics, other engine types,
Hindi/Hinglish generation, and open-ended analysis of imported notes need the
connected AI service. The margin guide can calculate explicitly labelled Revenue
and COGS values; it does not claim to analyse the rest of the document.

Keep `OPENAI_API_KEY` on the server, in Vercel environment variables or local
`.env.development.local`; never use a `VITE_` prefix. The copilot chooses
`OPENAI_ASSISTANT_MODEL`, then `OPENAI_MODEL`, then `gpt-6-luna`. Set the dedicated
assistant variable when keeping a separate legacy command model. Verified
GPT-6 Luna/Sol configurations use low reasoning effort; other model overrides
must support Responses structured outputs and, when requested, web search.

Requests are bounded to 4,000 question characters, 12,000 note characters, the
last 12 transcript turns of at most 1,500 characters each, and a 128 KiB body.
The server sends this bounded context to the Responses API with `store: false`;
it does not create a durable server-side conversation. Responses allow
1,200–3,200 output tokens, up to two web tool calls, and a 38-second timeout.
Provider errors, refusals, and invalid output return a clearly labelled guide.
Live provider behavior has not been verified without a real API key; regression
tests exercise the AI path with mocked Responses payloads.

Web research is off by default and incurs provider tool usage when enabled.
Source links are accepted only from actual web-search URL citation annotations;
model-invented citation fields are discarded. If research or citation extraction
does not complete, the response says so. Review evidence before presenting
current facts. See the official [structured outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs)
and [web search documentation](https://developers.openai.com/api/docs/guides/tools-web-search).

The assistant rejects obvious cross-origin browser requests and does not emit
permissive CORS headers. Paid requests are limited to six per IP per minute,
30 total per minute, and four concurrent calls **within each warm server
instance**; excess calls return `429` with `Retry-After`. These in-memory limits
reset on cold starts and are neither distributed quotas nor authentication.
For a public paid deployment, configure provider spending limits and add shared
rate limiting or user authentication as needed. The local guide path remains
available without paid calls.

Run the server regression suite after `npm ci`:

```bash
node tests/assistant.test.cjs
```

The suite covers context resolution, all built-in models, numeric calculations,
input/visual validation, source provenance, actual citation annotations, AI
disable, cross-origin rejection, rate and concurrency limits, and safe provider
failure handling. It uses the installed Vite/esbuild dependency and makes no
real provider requests.

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
- Built-in models are simplified educational illustrations. Detailed third-party models load from Sketchfab and require its service to be available.

## Suggested classroom setup

1. Connect laptop to projector or smart board.
2. Open the app in Chrome.
3. Choose **Listen to the presentation**; open **Hands-free model controls** if you want camera gestures.
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
