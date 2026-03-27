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

    const participantId = `P${uuidv4().slice(0, 8).toUpperCase()}`;
    const sessionId = uuidv4();

    const { error: sessionError } = await supabase
      .from('sessions')
      .insert([
        {
          id: sessionId,
          participant_id: participantId,
          condition,
          friction_frequency: frictionFrequency ?? null,
        },
      ]);

    if (sessionError) {
      console.error('create session error:', sessionError);
      return res.status(500).json({ error: sessionError.message });
    }

    if (demographics) {
      const { error: demoError } = await supabase
        .from('demographics')
        .insert([
          {
            session_id: sessionId,
            age: demographics.age,
            gender: demographics.gender,
            social_media_usage: demographics.socialMediaUsage,
            platforms_used: demographics.platformsUsed ?? [],
          },
        ]);

      if (demoError) {
        console.error('insert demographics error:', demoError);
        return res.status(500).json({ error: demoError.message });
      }
    }

    res.status(201).json({
      sessionId,
      participantId,
      condition,
      frictionFrequency,
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

      rawEventRows.push({
        session_id: id,
        type,
        ts: _ts ? new Date(_ts).toISOString() : new Date().toISOString(),
        payload,
      });

      if (type === 'post_view') {
        postViewRows.push({
          session_id: id,
          post_id: payload.postId,
          category: payload.category ?? null,
          start_ts: payload.startTs ? new Date(payload.startTs).toISOString() : null,
          end_ts: payload.endTs ? new Date(payload.endTs).toISOString() : null,
          dwell_ms: payload.dwellMs ?? null,
          scroll_depth: payload.scrollDepth ?? null,
        });
      }

      if (type === 'friction_done') {
        frictionRows.push({
          session_id: id,
          friction_type: payload.frictionType,
          trigger_index: payload.triggerPostIndex ?? null,
          duration_ms: payload.durationMs ?? null,
          action: payload.action ?? null,
          shown_at: new Date().toISOString(),
        });
      }
    }

    const { error: rawError } = await insertMany('events', rawEventRows);
    if (rawError) {
      console.error('insert events error:', rawError);
      return res.status(500).json({ error: rawError.message });
    }

    const { error: viewError } = await insertMany('post_views', postViewRows);
    if (viewError) {
      console.error('insert post_views error:', viewError);
      return res.status(500).json({ error: viewError.message });
    }

    const { error: frictionError } = await insertMany('friction_events', frictionRows);
    if (frictionError) {
      console.error('insert friction_events error:', frictionError);
      return res.status(500).json({ error: frictionError.message });
    }

    res.json({ inserted: events.length });
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

    const rows = responses.map((r) => ({
      session_id: id,
      post_id: r.postId,
      memory_label: r.memoryLabel,
      participant_answer: r.participantAnswer,
      correct: r.correct,
      rt_ms: r.rtMs,
      category: r.category ?? null,
    }));

    const { error: insertError } = await insertMany('memory_responses', rows);
    if (insertError) {
      console.error('insert memory_responses error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    const hits = responses.filter((r) => r.memoryLabel === 'old' && r.correct).length;
    const fas = responses.filter((r) => r.memoryLabel === 'new' && !r.correct).length;
    const oldN = responses.filter((r) => r.memoryLabel === 'old').length;
    const newN = responses.filter((r) => r.memoryLabel === 'new').length;

    if (oldN > 0 || newN > 0) {
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
    }

    res.json({ inserted: responses.length });
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

    const rows = Object.entries(responses).map(([qId, val]) => ({
      session_id: id,
      question_id: qId,
      value: String(val),
    }));

    if (rows.length === 0) {
      return res.json({ ok: true });
    }

    const { error } = await supabase
      .from('survey_responses')
      .upsert(rows, {
        onConflict: 'session_id,question_id',
      });

    if (error) {
      console.error('upsert survey_responses error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true });
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

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        feed_duration_ms: summary.feedDurationMs,
        post_count: summary.postCount,
        completed_at: new Date().toISOString(),
      })
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