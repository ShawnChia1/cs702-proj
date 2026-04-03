/**
 * api.js
 *
 * Thin wrapper around fetch for the backend REST API.
 * Base URL is read from VITE_API_URL env var (falls back to localhost).
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/** Create a new study session. Returns { sessionId, participantId, condition, frictionFrequency } */
export const createSession = (payload) =>
  request('POST', '/sessions', {
    ...payload,
    condition: payload.condition?.trim().toLowerCase(),
  });

/** Mark session as complete and upload all telemetry in one shot. */
export const submitSession = (sessionId, payload) =>
  request('POST', `/sessions/${sessionId}/submit`, payload);

// ── Events (incremental upload during session) ────────────────────────────────

/** Batch-upload telemetry events. Called periodically so data isn't lost. */
export const uploadEvents = (sessionId, events) =>
  request('POST', `/sessions/${sessionId}/events`, { events });

// ── Survey ────────────────────────────────────────────────────────────────────

export const submitSurvey = (sessionId, responses) =>
  request('POST', `/sessions/${sessionId}/survey`, { responses });

// ── Memory test ──────────────────────────────────────────────────────────────

export const submitMemoryTest = (sessionId, responses) =>
  request('POST', `/sessions/${sessionId}/memory`, { responses });

export default { createSession, submitSession, uploadEvents, submitSurvey, submitMemoryTest };
