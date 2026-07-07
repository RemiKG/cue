# Cue — *Dinner, on cue.*

> **A recipe tells you what to do. It never tells you *when*.**
>
> Prop a spare phone at the stove. Cue watches your pans with its own eyes, learns your
> whole meal, and **conducts the timing** — calling every move at the exact beat so a
> dozen dishes all land hot, together — and it **never sends a frame of your kitchen
> anywhere.**

Cue turns any spare phone or laptop into an **edge conductor** for your stove. It
**perceives on the device** (camera + microphone → on-device object / doneness / audio
reflex), **reasons in Qwen Cloud** (a resource-constrained schedule-graph + live
re-optimization), and **acts locally** (spoken cues, an on-screen orchestral score, and
instant local safety alerts). Track 5 — EdgeAgent, Qwen Cloud Global AI Hackathon.

The whole app is drawn as **"The Stove as an Orchestral Score"**: burners and hands are
staff lines, actions are notes, a *now* bar sweeps toward a single **held chord** — the
moment every dish is done at once. When reality diverges, the notes visibly slide to keep
the finale aligned. That slide is the re-optimizer, rendered as something you can watch.

![Architecture — perceive → reason → act → degrade](docs/architecture.png)

---

## The one undeniable mechanic

**Point the phone at the stove → it reads the pans → it plans the whole meal → it
conducts the timing → everything lands hot together → it re-plans live the moment you
diverge.**

The money shot is un-fakeable: on your own meal, with your own disruption (swap white
rice → brown, fall behind, let a pan run hot), Cue re-optimizes the *entire* timeline live
so everything still lands together — computed on your disruption, not scripted.

![Before / after — finish-spread](docs/before-after.png)

---

## Architecture

Cue is **one loop** — `perceive → reason → act → degrade` — split across the edge (the
phone) and Qwen Cloud. It runs as a **static PWA client** plus a **thin server** whose
only job is to hold the `sk-` key and proxy Qwen. The client is fully functional on its
own; the server is an enhancement seam.

```
┌───────────────────────── the phone (edge) ─────────────────────────┐      ┌── Qwen Cloud ──┐
│                                                                     │      │  dashscope-intl │
│  getUserMedia ─▶ on-device reflex (non-Qwen, WebGPU/WASM)           │      │                 │
│    · object detector  (TF.js COCO-SSD)                              │      │ qwen3-vl-plus   │
│    · doneness CV       (motion / hue / steam)   ──┐ distilled       │ ───▶ │ qwen3.7-plus    │
│    · audio DSP + VAD   (sizzle / boil / alarm)    │ pan-states +    │      │ qwen3.7-max     │
│                                                    │ a rare BLURRED  │      │ text-embedding  │
│  scheduler + re-optimizer (deterministic, real) ◀─┘ keyframe        │ ◀─── │ qwen3-tts-flash │
│  conductor / transport → spoken cue (Web Speech) + the Score        │      └─────────────────┘
│  safety layer (LOCAL boil-over / smoke alert, zero cloud)           │
│  Kitchen Score (append-only NDJSON, IndexedDB) + calibrations       │      raw A/V NEVER leaves
│  service worker → offline: conduct from cache, queue, reconnect     │      the device
└─────────────────────────────────────────────────────────────────────┘
```

**Two paths, one engine.** A clearly-labelled **illustrated demo** simulates the sensor
input so a visitor with no stove can watch the whole loop (including one live re-plan) in
under a minute; the **live path** uses the real camera + microphone. The reasoning
(scheduling, re-optimization, safety) is identical in both.

**Cloud is an env-var seam.** With `DASHSCOPE_API_KEY` set, Qwen grounds durations
(`text-embedding-v4`), reads the blurred keyframe (`qwen3-vl-plus`), refines the
schedule-graph (`qwen3.7-plus`), narrates the re-plan (`qwen3.7-max`), and can speak the
cue (`qwen3-tts-flash`). **Without a key, Cue degrades honestly**: a real on-device
deterministic planner does the scheduling/re-optimization, lexical retrieval grounds the
dishes, and the device's own speech synthesis speaks the cues. The app never blocks.

### Where the code lives

```
repo/
├─ index.html                 # PWA entry
├─ src/
│  ├─ main.tsx                # boot: store init, service-worker registration
│  ├─ App.tsx                 # shell + screen router
│  ├─ brand/                  # the hand-vector design system
│  │  ├─ palette.ts           #   locked palette (cream + ink + ember, no red)
│  │  ├─ svgKit.ts            #   Maestro, wordmark, logomark, enamel stove-feed, gauges
│  │  ├─ Score.tsx            #   the interactive orchestral score (staves/notes/now-bar/finale)
│  │  ├─ widgets.tsx          #   Gauge · SplitFlap · Tag
│  │  └─ index.tsx            #   CueDefs + React wrappers
│  ├─ engine/                 # the real, computed heart
│  │  ├─ types.ts             #   domain model (schedule-graph, events, log)
│  │  ├─ scheduler.ts         #   resource-constrained back-aligning scheduler
│  │  ├─ reoptimize.ts        #   live re-optimization on divergence (the money shot)
│  │  ├─ retrieval.ts         #   lexical + embedding retrieval over the bundled index
│  │  ├─ safety.ts            #   deterministic policy layer (never certifies food safe)
│  │  ├─ persist.ts           #   IndexedDB: Kitchen Score (NDJSON), calibrations, settings
│  │  └─ scoreSpec.ts         #   Schedule → drawable ScoreSpec
│  ├─ perception/             # on-device sensing (non-Qwen)
│  │  ├─ camera.ts            #   getUserMedia + frame sampling
│  │  ├─ objectDetector.ts    #   TF.js COCO-SSD (lazy, CDN, cached by the SW)
│  │  ├─ doneness.ts          #   classical CV doneness/state reflex
│  │  ├─ audio.ts             #   Web Audio DSP: sizzle/boil/fry + smoke-alarm + VAD
│  │  ├─ keyframe.ts          #   the privacy transform (background-blurred keyframe)
│  │  ├─ reflex.ts            #   the always-on edge loop
│  │  ├─ voice.ts             #   spoken cue (Web Speech default; Qwen-TTS seam)
│  │  ├─ sound.ts             #   the LOCAL wooden-spoon tap (never a siren)
│  │  └─ metrics.ts           #   FPS + live-figure meters
│  ├─ cloud/qwen.ts           # client seam → relative /api/* (never a hardcoded host)
│  ├─ data/recipes.ts         # the bundled, openly-licensed (CC0) recipe/timing index
│  ├─ state/store.ts          # the session store + the conductor tick + demo driver
│  ├─ screens/                # the ten screens (00 landing … 09 engine)
│  └─ styles/                 # the enamel design system (CSS)
├─ server/
│  ├─ qwen.ts                 # THE code file with the dashscope-intl base URL + models
│  └─ index.ts                # Hono proxy (/api/*) + static host for the built client
├─ public/                    # icons, manifest, self-hosted fonts, service worker
└─ Dockerfile                 # container image (Alibaba Cloud ECS/SAS deploy target)
```

---

## Running it

Requires **Node ≥ 20**. Camera/microphone need a **secure context** (`localhost` counts).

```bash
npm install

# development — Vite client (:5173) + Hono API (:8787), together.
# The API takes a few seconds to compile on first boot; Vite proxies /api to it.
npm run dev
#   → open http://localhost:5173

# production — build the client, then serve client + API from one Node process.
npm run serve
#   → open http://localhost:8787
```

To activate the real Qwen Cloud path, copy `.env.example` to `.env` and set
`DASHSCOPE_API_KEY`. Without it the app runs on the on-device deterministic path and the
UI says so honestly (the *Engine* screen shows the live cloud status).

### Docker (the deploy target)

```bash
docker build -t cue .
docker run -p 8787:8787 -e DASHSCOPE_API_KEY=sk-... cue
```

---

## What is REAL

Everything below genuinely works end-to-end. A clearly-labelled demo sits *on top* of the
real path.

- **The input is your own live camera + microphone** (`getUserMedia`) — real frames, real audio.
- **On-device perception runs locally, in the browser** (non-Qwen): a TensorFlow.js
  object detector, a classical-CV doneness/state reflex, and a Web Audio classifier + VAD.
  Measured on a laptop headless: **~22–24 fps**. It emits structured pan-state events.
- **Raw A/V never leaves the device.** Only distilled states and — occasionally — a single
  **background-blurred** keyframe (only the pan region legible) are sent to the cloud.
- **The scheduling and live re-optimization are real, computed reasoning** over the sensed
  states + constraints (finite burners, two hands, a single finish-together deadline). The
  money shot is computed on your disruption. Qwen refines/narrates it when a key is present.
- **Action is local:** the cue is spoken through the phone's speaker; the score sweeps;
  and the **boil-over / smoke alert fires locally** (a soft wooden-spoon tap via Web Audio)
  with **zero cloud round-trip**.
- **Offline is real:** a service worker caches the app + score; lose the network and Cue
  keeps conducting, tracks states locally, and queues keyframes; reconnect → re-optimize +
  back-fill. The local safety reflex still fires with the network off.
- **Persistence is real:** the **Kitchen Score** is append-only **NDJSON in IndexedDB**
  (exportable / shareable); per-stove **calibrations** persist on the device. Raw
  camera/mic is never persisted or uploaded.
- **Recipe grounding is real retrieval** over a **bundled, openly-licensed (CC0)** index —
  lexical always; `text-embedding-v4` cosine when a key is present. A fixed dataset, not a
  web crawl.

### Honestly scoped

- **Doneness perception is limited** — reliable on clearly-separable states; on hard reads
  Cue **hedges and asks you**. Its accuracy is *not* the load-bearing wow; the re-planning is.
- **Cue never certifies food safe.** The one high-harm read (is the protein cooked
  through?) is deliberately routed to a **thermometer** — a first-class, non-overridable UI
  state (the *cool and still* grey), not fine print.
- **Owner-voice cloning, household pings (comms-MCP), and pantry lists (pantry-MCP)** are
  opt-in, human-gated extras — never the core.
- **The measured numbers** ship as measured on commodity hardware (finish-spread, fps, cue
  latency, bytes/meal); demo targets are noted where a value differs.

---

## Track-5 fit

A Qwen-powered edge device (a spare phone) that **perceives via edge sensors**, **reasons
via cloud APIs/Skills** (`read-doneness · plan-meal · conduct-timeline · call-cue`), and
**acts locally**.

- **Edge–cloud orchestration** under bandwidth/latency — the local reflex fires
  split-second cues; only distilled states + rare keyframes escalate.
- **Privacy-aware handling** — raw A/V never leaves; keyframes are background-blurred; the
  UI is an illustrated diagram.
- **Graceful offline degradation.**
- **Uses Qwen Cloud APIs** — `dashscope-intl` base URL in `server/qwen.ts`; no self-hosted
  Qwen (the on-device models are non-Qwen by construction).

## License

MIT — see [LICENSE](LICENSE). The bundled recipe/timing data is original and CC0.
