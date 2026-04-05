-- ScrollStudy database schema
-- Supports all metrics defined in the evaluation plan

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id       TEXT NOT NULL,
    condition            TEXT NOT NULL CHECK (condition IN ('control','reaction','button','feedback','pause','minigame','slowdown')),
    friction_frequency   INTEGER,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    feed_started_at      TIMESTAMPTZ,
    feed_ended_at        TIMESTAMPTZ,
    feed_duration_ms     INTEGER,
    post_count           INTEGER,
    -- Memory test aggregate metrics (d' components)
    memory_hit_rate      REAL,
    memory_fa_rate       REAL,
    completed_at         TIMESTAMPTZ,
    status               TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

-- ── Demographics ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demographics (
    session_id           UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    age                  INTEGER,
    gender               TEXT,
    social_media_usage   TEXT,    -- 'less-1h' | '1-2h' | '2-4h' | 'more-4h'
    platforms_used       TEXT[]
);

-- ── Telemetry events ──────────────────────────────────────────────────────────
-- Stores every granular event (post views, scrolls, friction interactions)
CREATE TABLE IF NOT EXISTS events (
    id             BIGSERIAL PRIMARY KEY,
    session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type           TEXT NOT NULL,   -- post_view | scroll | friction_shown | friction_done | session_start | session_end
    ts             TIMESTAMPTZ NOT NULL,
    payload        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS events_session_id_idx ON events(session_id);
CREATE INDEX IF NOT EXISTS events_type_idx       ON events(type);

-- ── Post-view aggregate (materialised per post for quick analysis) ─────────────
CREATE TABLE IF NOT EXISTS post_views (
    id             BIGSERIAL PRIMARY KEY,
    session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    post_id        TEXT NOT NULL,
    category       TEXT,
    start_ts       TIMESTAMPTZ,
    end_ts         TIMESTAMPTZ,
    dwell_ms       INTEGER NOT NULL,
    scroll_depth   REAL             -- 0.0–1.0
);

CREATE INDEX IF NOT EXISTS post_views_session_idx  ON post_views(session_id);
CREATE INDEX IF NOT EXISTS post_views_post_idx     ON post_views(post_id);

-- ── Friction events (aggregate) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friction_events (
    id               BIGSERIAL PRIMARY KEY,
    session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    friction_type    TEXT NOT NULL,
    trigger_index    INTEGER,        -- which post number triggered it
    shown_at         TIMESTAMPTZ,
    duration_ms      INTEGER,
    action           TEXT            -- reaction chosen / 'continue' / 'pause_ended' / etc.
);

-- ── Memory test responses ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_responses (
    id                 BIGSERIAL PRIMARY KEY,
    session_id         UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    post_id            TEXT NOT NULL,
    memory_label       TEXT NOT NULL CHECK (memory_label IN ('old','new')),
    participant_answer TEXT NOT NULL CHECK (participant_answer IN ('old','new')),
    correct            BOOLEAN NOT NULL,
    rt_ms              INTEGER,
    category           TEXT
);

-- ── Survey responses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_responses (
    id           BIGSERIAL PRIMARY KEY,
    session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_id  TEXT NOT NULL,
    value        TEXT,              -- Likert 1–5 or free text
    UNIQUE (session_id, question_id)
);
