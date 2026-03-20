# ScrollStudy

A web application that reproduces the infinite social media scrolling experiment from:

> Ruiz, N., Molina León, G., & Heuer, H. (2024). **Design Frictions on Social Media: Balancing Reduced Mindless Scrolling and User Satisfaction.** *MuC '24*, Karlsruhe, Germany.

Built for CS702. Implements the paper's original reaction-based friction condition alongside three additional friction modalities proposed by the team, all within a controlled between-subjects study design.

---

## Quick Start (local, no backend)

```bash
cd frontend
rm -rf node_modules package-lock.json   # only needed first time / after cloning
npm install
npm run dev
```

Open **http://localhost:5173** — you'll land on the consent screen.

To test a specific condition, add URL params:
```
http://localhost:5173/?condition=reaction&freq=5
```

---

## Full Stack (frontend + backend + database)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) to be running.

```bash
# from the project root (cs702-proj/)
cp .env.example .env        # only needed first time
docker compose up --build
```

| Service  | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000/api |
| PostgreSQL | localhost:5432 |

To stop everything: `Ctrl+C`, then `docker compose down`.

To wipe the database and start fresh: `docker compose down -v`.

---

## Study Conditions

The study uses a **between-subjects design**: each participant is assigned to exactly one condition. Condition assignment is controlled via URL params so the researcher can counterbalance across participants.

### Control — `?condition=control`

**What it is:** Standard infinite-scroll feed with no friction of any kind. Posts load continuously as the user scrolls down, identical to how Instagram, TikTok, or Reddit works by default.

**Why it's in the study:** This is the baseline that all friction conditions are compared against. It directly reproduces the *infinite-scroll version* from Figure 1 of the paper. Any differences in memory performance, dwell time, or satisfaction scores between this group and the intervention groups are attributable to the friction mechanism.

**What to expect:** You scroll freely through all 30 posts. No prompts, no gates, no overlays.

---

### Reaction-Based — `?condition=reaction`

**What it is:** An overlay appears after every single post asking the user to select one of four reactions — **Like 👍**, **Congratulations! 🎉**, **Inspiring! 💡**, **Love it! ❤️** — or press **Not Interested**. Scrolling is blocked until a reaction is chosen.

**Why it's in the study:** This is the paper's original *reaction-based intervention* (Figure 1, left side) and the primary replication target. The paper found significantly better memory recall (higher d') in this condition compared to infinite-scroll control, but 53% of participants found it frustrating. Our study re-examines this trade-off using the same friction type but with a consistent infinite-scroll base across all conditions.

**What to expect:** After every post scrolled past, a reaction overlay blocks the feed. Choose any reaction (or Not Interested) to continue. There is no `freq` parameter — it always fires on every post (equivalent to `freq=1`).

---

### Button Toggle — `?condition=button&freq=5`

**What it is:** A minimal tap-to-continue overlay. After every N posts are scrolled past, a modal appears with a single **"Continue browsing"** button. Scrolling is blocked until it is tapped.

**Why it's in the study:** This is the lowest-intrusiveness friction modality. It introduces a brief motor interruption (requiring an intentional tap) without demanding any cognitive evaluation of the content. It tests whether even a minimal physical break is sufficient to reduce mindless scrolling, while keeping frustration low.

**What to expect:** Posts 1 to N-1 pass freely. At post N a centred modal appears. Tap the button and browsing resumes immediately. Repeat every N posts.

---

### Content Feedback — `?condition=feedback&freq=5`

**What it is:** A two-option relevance rating overlay — **"Yes, relevant 👍"** or **"Not really 👎"** — appears every N posts. The user must rate the most recent post before continuing.

**Why it's in the study:** This modality anchors the friction to the browsing task itself. Asking users to evaluate content relevance encourages a moment of reflective engagement without being as demanding as four-option reactions. It also generates secondary data (relevance ratings) that can be compared against memory performance.

**What to expect:** Every N posts a two-button modal appears. Pick either option — both let you continue. The choice is logged as a telemetry event.

---

### Pause Screen — `?condition=pause&freq=5`

**What it is:** A timed reflective pause. Every N posts, a 7-second overlay displays a neutral mindfulness quote. No user input is required — it auto-dismisses when the countdown reaches zero.

**Why it's in the study:** This tests whether a passive temporal interruption (no action required) is enough to break the automaticity of scrolling. It is inspired by Haliburton et al.'s work on customisable short delays and Wang et al.'s time-delay interventions on Facebook. It is the least demanding of all friction types.

**What to expect:** Every N posts a quote card appears with a circular countdown. Wait 7 seconds and browsing resumes automatically. You can see a new random quote each time from a pool of eight.

---

### Mini-Game — `?condition=minigame&freq=5`

**What it is:** A brief tap-target game. Three coloured dots appear one at a time on a small canvas; the user taps each dot to proceed. Takes roughly 5 seconds at a relaxed pace.

**Why it's in the study:** This is the highest-engagement friction modality. It tests whether a playful, game-like interruption can reduce mindless scrolling while keeping frustration lower than the reaction-based condition. The game requires active attention but is entirely unrelated to post content, making it a pure motor/attention reset.

**What to expect:** Every N posts a small game panel appears with three sequential targets. Tap each dot as it appears. A Skip button is available if the game is not completed within 12 seconds.

---

## The `freq` Parameter

For all conditions except `reaction` (which fires on every post), `freq` controls how often friction appears — every N posts.

| `freq` value | Friction fires at post… | Friction shown over 30 posts |
|:---:|---|:---:|
| `3` | 3, 6, 9, 12 … 30 | 10× |
| `5` | 5, 10, 15, 20 … 30 | 6× |
| `10` | 10, 20, 30 | 3× |
| `15` | 15, 30 | 2× |

The default (if `freq` is omitted) is **5**.

---

## Full Study Flow

Each participant goes through exactly these steps in order:

1. **Consent** — reads study information, ticks the agreement checkbox
2. **Demographics** — age, gender, daily social media usage, platforms used
3. **Feed instructions** — brief explanation (friction condition participants are told interactions may appear)
4. **Feed browsing** — 30 posts, exposure phase (~8–20 min depending on condition)
5. **Stroop task** — 30-second colour-naming distractor to reduce recency bias
6. **Memory recognition test** — 20 old posts + 6 new distractors, shuffled; participant presses Old / New for each; response time is recorded
7. **Survey** — 5 general Likert items + 7 interface-specific items (friction conditions only) + open-ended feedback

---

## Metrics Collected

All of these are logged client-side throughout the session and submitted to the backend on completion.

| Metric | How it's measured |
|---|---|
| **Dwell time per post** | IntersectionObserver — time the post card is ≥50% visible |
| **Session duration** | Timestamp delta: feed start → feed end |
| **Scroll behaviour** | Throttled scroll events: position, direction, velocity (px/ms) |
| **Friction interaction** | Per-event: type, duration from shown→dismissed, action taken |
| **Content recall (d')** | Hit rate (old correctly identified) and false alarm rate (new incorrectly called old), from which d' is computed |
| **Response time** | ms from card display to Old/New button press in memory test |
| **Survey responses** | Likert 1–5 per item, stored per question ID |
| **Demographics** | Age, gender, daily usage, platforms |

---

## Participant Assignment (for the actual study)

Generate a link for each participant with a pre-assigned condition. A simple counterbalancing scheme for 12 participants across 6 conditions:

```
P01  http://localhost:5173/?condition=control&freq=5
P02  http://localhost:5173/?condition=reaction
P03  http://localhost:5173/?condition=button&freq=5
P04  http://localhost:5173/?condition=feedback&freq=5
P05  http://localhost:5173/?condition=pause&freq=5
P06  http://localhost:5173/?condition=minigame&freq=5
P07  http://localhost:5173/?condition=control
P08  http://localhost:5173/?condition=reaction
P09  http://localhost:5173/?condition=button&freq=5
P10  http://localhost:5173/?condition=feedback&freq=5
P11  http://localhost:5173/?condition=pause&freq=5
P12  http://localhost:5173/?condition=minigame&freq=5
```

Once the backend is running, each session is stored in PostgreSQL under a randomly generated participant ID (e.g. `P3A7F1C2`). The researcher never sees personal information.

---

## Project Structure

```
cs702-proj/
├── README.md
├── docker-compose.yml          ← spins up frontend + backend + postgres
├── .env.example                ← copy to .env and fill in values
├── frontend/                   ← React + Vite + Tailwind CSS
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── data/posts.js       ← 36 posts across 10 categories
│       ├── store/sessionStore.js
│       ├── hooks/              ← useDwellTime, useScrollTracker
│       ├── services/api.js
│       ├── components/
│       │   ├── PostCard.jsx
│       │   ├── feed/           ← InfiniteScrollFeed, FrictionFeed
│       │   ├── friction/       ← one component per modality
│       │   └── study/          ← ConsentForm, DemographicsForm, MemoryTest, Survey
│       └── pages/
├── backend/                    ← Express + PostgreSQL
│   ├── Dockerfile
│   └── src/app.js
└── infra/db/init.sql           ← database schema
```
