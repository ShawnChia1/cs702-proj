import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// quick startup check
try {
  const { error } = await supabase.from('demographics').select('*').limit(1);
  if (error) {
    console.error('❌ Supabase connection check failed:', error.message);
  } else {
    console.log('✅ Supabase connected via HTTPS');
  }
} catch (err) {
  console.error('❌ Supabase startup error:', err);
}

// middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// helpers
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

async function insertMany(table, rows) {
  if (!rows || rows.length === 0) return { error: null };
  return await supabase.from(table).insert(rows);
}

// health
app.get('/health', (_, res) => {
  res.json({ status: 'ok', ts: new Date() });
});

// create session
app.post('/api/sessions', async (req, res) => {
  try {
    const { condition, frictionFrequency, demographics } = req.body;

    const allowedConditions = new Set([
      'control',
      'reaction',
      'button',
      'feedback',
      'pause',
      'minigame',
      'slowdown',
    ]);

    if (!condition || typeof condition !== 'string') {
      return badRequest(res, 'condition is required');
    }

    const normalizedCondition = condition.trim().toLowerCase();

    if (!allowedConditions.has(normalizedCondition)) {
      return badRequest(
        res,
        `invalid condition "${condition}". Allowed: ${[...allowedConditions].join(', ')}`
      );
    }

    if (
      frictionFrequency !== undefined &&
      frictionFrequency !== null &&
      !Number.isInteger(frictionFrequency)
    ) {
      return badRequest(res, 'frictionFrequency must be an integer or null');
    }

    const participantId = `P${uuidv4().slice(0, 8).toUpperCase()}`;
    const sessionId = uuidv4();
    const nowIso = new Date().toISOString();

    const { error: sessionError } = await supabase
      .from('sessions')
      .insert([
        {
          id: sessionId,
          participant_id: participantId,
          condition: normalizedCondition,
          friction_frequency: frictionFrequency ?? null,
          created_at: nowIso,
          feed_started_at: nowIso,
        },
      ]);

    if (sessionError) {
      console.error('create session error:', sessionError);
      return res.status(500).json({
        error: sessionError.message,
        details: sessionError.details ?? null,
        code: sessionError.code ?? null,
      });
    }

    if (demographics) {
      const { error: demoError } = await supabase
        .from('demographics')
        .insert([
          {
            session_id: sessionId,
            age: demographics.age ?? null,
            gender: demographics.gender ?? null,
            social_media_usage: demographics.socialMediaUsage ?? null,
            platforms_used: demographics.platformsUsed ?? [],
          },
        ]);

      if (demoError) {
        console.error('insert demographics error:', demoError);

        // rollback session if demographics insert fails
        await supabase.from('sessions').delete().eq('id', sessionId);

        return res.status(500).json({
          error: demoError.message,
          details: demoError.details ?? null,
          code: demoError.code ?? null,
        });
      }
    }

    res.status(201).json({
      sessionId,
      participantId,
      condition: normalizedCondition,
      frictionFrequency: frictionFrequency ?? null,
    });
  } catch (err) {
    console.error('POST /api/sessions failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// batch upload events
app.post('/api/sessions/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { events = [] } = req.body;

    if (!Array.isArray(events)) {
      return badRequest(res, 'events must be an array');
    }

    const rawEventRows = [];
    const postViewRows = [];
    const frictionRows = [];

    for (const ev of events) {
      const { type, _ts, payload = {} } = ev;

      if (!type) continue;

      rawEventRows.push({
        session_id: id,
        type,
        ts: _ts ? new Date(_ts).toISOString() : new Date().toISOString(),
        payload,
      });

      if (type === 'post_view') {
        if (!payload.postId) {
          console.warn('Skipping post_view without postId:', payload);
        } else {
          postViewRows.push({
            session_id: id,
            post_id: String(payload.postId),
            category: payload.category ?? null,
            start_ts: payload.startTs ? new Date(payload.startTs).toISOString() : null,
            end_ts: payload.endTs ? new Date(payload.endTs).toISOString() : null,
            dwell_ms: Number.isFinite(payload.dwellMs) ? Math.round(payload.dwellMs) : 0,
            scroll_depth: typeof payload.scrollDepth === 'number' ? payload.scrollDepth : null,
          });
        }
      }

      if (type === 'friction_done') {
        console.log('friction_done payload:', JSON.stringify(payload, null, 2));
        const frictionType =
          payload.frictionType ??
          payload.friction_type ??
          payload.type ??
          payload.condition ??
          null;

        if (!frictionType) {
          console.warn('Skipping friction_done without frictionType:', payload);
        } else {
          frictionRows.push({
            session_id: id,
            friction_type: String(frictionType),
            trigger_index: Number.isInteger(payload.triggerPostIndex)
              ? payload.triggerPostIndex
              : (Number.isInteger(payload.trigger_index) ? payload.trigger_index : null),
            duration_ms: Number.isFinite(payload.durationMs)
              ? Math.round(payload.durationMs)
              : (Number.isFinite(payload.duration_ms) ? Math.round(payload.duration_ms) : null),
            action: payload.action ?? null,
            shown_at: payload.shownAt
              ? new Date(payload.shownAt).toISOString()
              : (payload.shown_at
                  ? new Date(payload.shown_at).toISOString()
                  : (_ts ? new Date(_ts).toISOString() : new Date().toISOString())),
          });
        }
      }
    }

    const { error: rawError } = await insertMany('events', rawEventRows);
    if (rawError) {
      console.error('insert events error:', rawError);
      return res.status(500).json({ where: 'events', error: rawError.message, details: rawError.details ?? null });
    }

    const { error: viewError } = await insertMany('post_views', postViewRows);
    if (viewError) {
      console.error('insert post_views error:', viewError);
      return res.status(500).json({ where: 'post_views', error: viewError.message, details: viewError.details ?? null });
    }

    const { error: frictionError } = await insertMany('friction_events', frictionRows);
    if (frictionError) {
      console.error('insert friction_events error:', frictionError);
      return res.status(500).json({ where: 'friction_events', error: frictionError.message, details: frictionError.details ?? null });
    }

    res.json({
      insertedRawEvents: rawEventRows.length,
      insertedPostViews: postViewRows.length,
      insertedFrictionEvents: frictionRows.length,
    });
  } catch (err) {
    console.error('POST /api/sessions/:id/events failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// memory test
app.post('/api/sessions/:id/memory', async (req, res) => {
  try {
    const { id } = req.params;
    const { responses = [] } = req.body;

    if (!Array.isArray(responses)) {
      return badRequest(res, 'responses must be an array');
    }

    const rows = [];

    for (const r of responses) {
      const memoryLabel = String(r.memoryLabel ?? '').trim().toLowerCase();
      const participantAnswer = String(r.participantAnswer ?? '').trim().toLowerCase();

      if (!['old', 'new'].includes(memoryLabel)) {
        console.warn('Skipping invalid memoryLabel:', r);
        continue;
      }

      if (!['old', 'new'].includes(participantAnswer)) {
        console.warn('Skipping invalid participantAnswer:', r);
        continue;
      }

      rows.push({
        session_id: id,
        post_id: String(r.postId ?? ''),
        memory_label: memoryLabel,
        participant_answer: participantAnswer,
        correct: Boolean(r.correct),
        rt_ms: Number.isFinite(r.rtMs) ? Math.round(r.rtMs) : null,
        category: r.category ?? null,
      });
    }

    if (rows.length === 0) {
      return res.json({ inserted: 0 });
    }

    const { error: insertError } = await insertMany('memory_responses', rows);
    if (insertError) {
      console.error('insert memory_responses error:', insertError);
      return res.status(500).json({
        where: 'memory_responses',
        error: insertError.message,
        details: insertError.details ?? null,
      });
    }

    const hits = rows.filter((r) => r.memory_label === 'old' && r.correct).length;
    const fas = rows.filter((r) => r.memory_label === 'new' && !r.correct).length;
    const oldN = rows.filter((r) => r.memory_label === 'old').length;
    const newN = rows.filter((r) => r.memory_label === 'new').length;

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        memory_hit_rate: oldN ? hits / oldN : null,
        memory_fa_rate: newN ? fas / newN : null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('update sessions memory stats error:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ inserted: rows.length });
  } catch (err) {
    console.error('POST /api/sessions/:id/memory failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// survey
app.post('/api/sessions/:id/survey', async (req, res) => {
  try {
    const { id } = req.params;
    const { responses = {} } = req.body;

    let rows = [];

    if (Array.isArray(responses)) {
      rows = responses
        .filter((r) => r && r.question_id)
        .map((r) => ({
          session_id: id,
          question_id: String(r.question_id),
          value: r.value == null ? null : String(r.value),
        }));
    } else {
      rows = Object.entries(responses).map(([qId, val]) => ({
        session_id: id,
        question_id: qId,
        value: val == null ? null : String(val),
      }));
    }

    if (rows.length === 0) {
      return res.json({ ok: true, inserted: 0 });
    }

    const { error } = await supabase
      .from('survey_responses')
      .upsert(rows, { onConflict: 'session_id,question_id' });

    if (error) {
      console.error('upsert survey_responses error:', error);
      return res.status(500).json({
        where: 'survey_responses',
        error: error.message,
        details: error.details ?? null,
      });
    }

    res.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error('POST /api/sessions/:id/survey failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// final submit
app.post('/api/sessions/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const summary = req.body;

    if (Array.isArray(summary.rawEvents) && summary.rawEvents.length > 0) {
      const rows = summary.rawEvents.map((ev) => {
        const { type, _ts, payload = {} } = ev;
        return {
          session_id: id,
          type,
          ts: _ts ? new Date(_ts).toISOString() : new Date().toISOString(),
          payload,
        };
      });

      const { error: rawError } = await supabase.from('events').insert(rows);
      if (rawError) {
        console.error('submit rawEvents insert error:', rawError);
      }
    }

    const feedEndedAt = new Date().toISOString();

    const updatePayload = {
      feed_duration_ms: summary.feedDurationMs ?? null,
      post_count: summary.postCount ?? null,
      feed_ended_at: feedEndedAt,
      completed_at: feedEndedAt,
      status: 'completed',
    };

    if (summary.feedStartedAt) {
      updatePayload.feed_started_at = new Date(summary.feedStartedAt).toISOString();
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('submit session update error:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/sessions/:id/submit failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// admin list
app.get('/api/sessions', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        demographics (
          age,
          gender,
          social_media_usage
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('list sessions error:', error);
      return res.status(500).json({ error: error.message });
    }

    const rows = (data || []).map((s) => ({
      ...s,
      age: s.demographics?.[0]?.age ?? null,
      gender: s.demographics?.[0]?.gender ?? null,
      social_media_usage: s.demographics?.[0]?.social_media_usage ?? null,
    }));

    res.json(rows);
  } catch (err) {
    console.error('GET /api/sessions failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// mark abandoned — bulk-update all in_progress sessions
app.post('/api/sessions/mark-abandoned', async (_req, res) => {
  try {
    const { data: stale, error: fetchError } = await supabase
      .from('sessions')
      .select('id')
      .eq('status', 'in_progress');

    if (fetchError) {
      console.error('fetch in_progress sessions error:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    const sessionIds = (stale || []).map((s) => s.id);

    if (sessionIds.length === 0) {
      return res.json({ marked: 0, sessionIds: [] });
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ status: 'abandoned' })
      .in('id', sessionIds);

    if (updateError) {
      console.error('mark abandoned error:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ marked: sessionIds.length, sessionIds });
  } catch (err) {
    console.error('POST /api/sessions/mark-abandoned failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// session detail
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [
      sessionRes,
      viewsRes,
      frictionRes,
      memoryRes,
      surveyRes,
    ] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('post_views').select('*').eq('session_id', id),
      supabase.from('friction_events').select('*').eq('session_id', id),
      supabase.from('memory_responses').select('*').eq('session_id', id),
      supabase.from('survey_responses').select('*').eq('session_id', id),
    ]);

    if (sessionRes.error && sessionRes.error.code !== 'PGRST116') {
      console.error('get session error:', sessionRes.error);
      return res.status(500).json({ error: sessionRes.error.message });
    }

    for (const result of [viewsRes, frictionRes, memoryRes, surveyRes]) {
      if (result.error) {
        console.error('detail fetch error:', result.error);
        return res.status(500).json({ error: result.error.message });
      }
    }

    res.json({
      session: sessionRes.data ?? null,
      postViews: viewsRes.data ?? [],
      frictionEvents: frictionRes.data ?? [],
      memoryResponses: memoryRes.data ?? [],
      surveyResponses: surveyRes.data ?? [],
    });
  } catch (err) {
    console.error('GET /api/sessions/:id failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ScrollStudy backend listening on :${PORT}`);
});

export default app;