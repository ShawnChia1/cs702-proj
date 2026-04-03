/**
 * sessionStore.js
 *
 * Central Zustand store for the study session.
 *
 * Condition schema
 * ────────────────
 *  condition:
 *    'control'      → standard infinite-scroll feed, no friction
 *    'reaction'     → paper's original reaction-based friction (Like / Congratulations! / Inspiring! / Love it! / Not Interested)
 *    'button'       → soft friction: tap a button to continue
 *    'feedback'     → soft friction: quick 2-point content rating
 *    'pause'        → soft friction: 7-second reflective pause with quote
 *    'minigame'     → soft friction: brief tap-target mini-game
 *    'slowdown'     → adaptive friction: temporarily slows fast scrolling after bursty browsing
 *
 *  frictionFrequency: every N posts (3 | 5 | 10 | 15)  — ignored for 'control'
 *
 * Telemetry event types
 * ──────────────────────
 *  post_view      { postId, startTs, endTs, dwellMs, scrollDepth }
 *  scroll         { ts, scrollTop, direction, velocityPx }
 *  friction_shown { ts, frictionType, triggerPostIndex }
 *  friction_done  { ts, frictionType, durationMs, action }
 *  session_start  { ts, condition, frictionFrequency, participantId }
 *  session_end    { ts, totalDwellMs, postCount }
 */

import { create } from 'zustand';

// ── Condition helpers ────────────────────────────────────────────────────────

export const CONDITIONS = ['control', 'reaction', 'button', 'feedback', 'pause', 'minigame', 'slowdown'];
export const FRICTION_CONDITIONS = CONDITIONS.filter(c => c !== 'control');
export const FRICTION_FREQUENCIES = [3, 5, 10, 15];

/** Randomly assign a between-subjects condition (used in admin/counterbalancing) */
export function assignCondition() {
  return CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
}

// ── Store ────────────────────────────────────────────────────────────────────

const useSessionStore = create((set, get) => ({

  // ── Participant & condition ────────────────────────────────────────────────
  participantId: null,         // assigned server-side; stored here after /sessions POST
  condition: null,             // one of CONDITIONS
  frictionFrequency: 5,        // every N posts
  sessionId: null,             // UUID from backend

  // ── Study phase ───────────────────────────────────────────────────────────
  // 'consent' → 'demographics' → 'instructions' → 'feed' → 'memory' → 'survey' → 'done'
  phase: 'consent',

  // ── Demographics ──────────────────────────────────────────────────────────
  demographics: {
    age: '',
    gender: '',           // 'male' | 'female' | 'non-binary' | 'prefer-not'
    socialMediaUsage: '', // 'less-1h' | '1-2h' | '2-4h' | 'more-4h'
    platformsUsed: [],    // ['instagram', 'tiktok', 'twitter', 'facebook', 'reddit', 'other']
  },

  // ── Feed state ────────────────────────────────────────────────────────────
  feedStartTs: null,        // Date.now() when feed opened
  feedEndTs: null,
  postsViewed: [],          // ordered list of postIds seen in current session
  currentPostIndex: 0,      // used by reaction/friction-based feed

  // ── Telemetry events ──────────────────────────────────────────────────────
  events: [],               // array of event objects (see types above)

  // ── Memory test ───────────────────────────────────────────────────────────
  memoryTestPool: [],        // shuffled array of { ...post, memoryLabel }
  memoryResponses: [],       // [{ postId, memoryLabel, participantAnswer, correct, rtMs }]

  // ── Survey responses ──────────────────────────────────────────────────────
  surveyResponses: {},       // keyed by question id → Likert value (1–5) or string

  // ── Actions ───────────────────────────────────────────────────────────────

  setParticipantId: (id) => set({ participantId: id }),

  setCondition: (condition, frictionFrequency = 5) =>
    set({ condition, frictionFrequency }),

  setSessionId: (id) => set({ sessionId: id }),

  setPhase: (phase) => set({ phase }),

  setDemographics: (updates) =>
    set(s => ({ demographics: { ...s.demographics, ...updates } })),

  startFeed: () =>
    set({ feedStartTs: Date.now(), currentPostIndex: 0, postsViewed: [] }),

  endFeed: () => set({ feedEndTs: Date.now() }),

  markPostViewed: (postId) =>
    set(s => ({
      postsViewed: s.postsViewed.includes(postId)
        ? s.postsViewed
        : [...s.postsViewed, postId],
    })),

  advancePost: () =>
    set(s => ({ currentPostIndex: s.currentPostIndex + 1 })),

  setMemoryTestPool: (pool) => set({ memoryTestPool: pool }),

  recordMemoryResponse: (resp) =>
    set(s => ({ memoryResponses: [...s.memoryResponses, resp] })),

  setSurveyResponse: (questionId, value) =>
    set(s => ({ surveyResponses: { ...s.surveyResponses, [questionId]: value } })),

  // ── Telemetry ──────────────────────────────────────────────────────────────

  logEvent: (event) =>
    set(s => ({ events: [...s.events, { ...event, _ts: Date.now() }] })),

  logPostView: ({ postId, startTs, endTs, scrollDepth = 1.0 }) => {
    const dwellMs = endTs - startTs;
    get().logEvent({ type: 'post_view', postId, startTs, endTs, dwellMs, scrollDepth });
    get().markPostViewed(postId);
  },

  logScroll: ({ scrollTop, direction, velocityPx }) =>
    get().logEvent({ type: 'scroll', scrollTop, direction, velocityPx }),

  logFrictionShown: ({ frictionType, triggerPostIndex }) =>
    get().logEvent({ type: 'friction_shown', frictionType, triggerPostIndex }),

  logFrictionDone: ({ frictionType, shownTs, action }) => {
    const durationMs = Date.now() - shownTs;
    get().logEvent({ type: 'friction_done', frictionType, durationMs, action });
  },

  // ── Computed helpers ───────────────────────────────────────────────────────

  getTelemetrySummary: () => {
    const { events, postsViewed, memoryResponses, surveyResponses,
      condition, frictionFrequency, participantId, sessionId,
      feedStartTs, feedEndTs, demographics } = get();

    const postViews = events.filter(e => e.type === 'post_view');
    const frictionEvents = events.filter(e => e.type === 'friction_done');
    const scrollEvents = events.filter(e => e.type === 'scroll');

    const meanDwellMs = postViews.length
      ? postViews.reduce((s, e) => s + e.dwellMs, 0) / postViews.length
      : 0;

    const hits = memoryResponses.filter(r => r.memoryLabel === 'old' && r.correct).length;
    const fas  = memoryResponses.filter(r => r.memoryLabel === 'new' && !r.correct).length;
    const oldTotal = memoryResponses.filter(r => r.memoryLabel === 'old').length;
    const newTotal = memoryResponses.filter(r => r.memoryLabel === 'new').length;
    const hitRate = oldTotal ? hits / oldTotal : null;
    const faRate  = newTotal ? fas / newTotal  : null;

    return {
      participantId, sessionId, condition, frictionFrequency, demographics,
      feedDurationMs: feedEndTs && feedStartTs ? feedEndTs - feedStartTs : null,
      postCount: postsViewed.length,
      meanDwellMs: Math.round(meanDwellMs),
      frictionCount: frictionEvents.length,
      meanFrictionDurationMs: frictionEvents.length
        ? Math.round(frictionEvents.reduce((s, e) => s + e.durationMs, 0) / frictionEvents.length)
        : null,
      scrollEventCount: scrollEvents.length,
      memoryHitRate: hitRate,
      memoryFaRate: faRate,
      surveyResponses,
      rawEvents: events,
    };
  },

  reset: () => set({
    participantId: null, condition: null, frictionFrequency: 5, sessionId: null,
    phase: 'consent', demographics: { age: '', gender: '', socialMediaUsage: '', platformsUsed: [] },
    feedStartTs: null, feedEndTs: null, postsViewed: [], currentPostIndex: 0,
    events: [], memoryTestPool: [], memoryResponses: [], surveyResponses: {},
  }),
}));

export default useSessionStore;
