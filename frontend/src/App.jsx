/**
 * App.jsx
 *
 * Root component. Drives the study flow as a simple phase-based state machine:
 *
 *   consent → demographics → feed → memory → survey → done
 *
 * Condition assignment:
 *   – URL param  ?condition=reaction&freq=5   (for controlled counterbalancing)
 *   – Random assignment fallback              (for open deployment)
 *
 * The phone-frame wrapper constrains the app to a ~375px mobile layout so the
 * experience matches the paper's smartphone-based study.
 */

import React, { useEffect } from 'react';
import useSessionStore, { CONDITIONS, assignCondition } from './store/sessionStore';

import ConsentForm      from './components/study/ConsentForm';
import DemographicsForm from './components/study/DemographicsForm';
import FeedPage         from './pages/FeedPage';
import MemoryTestPage   from './pages/MemoryTestPage';
import SurveyPage       from './pages/SurveyPage';
import ThankYouPage     from './pages/ThankYouPage';
import api              from './services/api';

// ── Admin / debug overlay (only in dev) ───────────────────────────────────────
function DevBadge({ condition, phase }) {
  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed top-2 right-2 z-[9999] bg-black/70 text-white text-[10px] px-2 py-1 rounded-lg font-mono">
      {phase} · {condition ?? '—'}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const {
    phase, condition, setPhase, setCondition, setDemographics, setParticipantId,
    setSessionId, getTelemetrySummary,
  } = useSessionStore();

  // ── Condition assignment from URL or random ─────────────────────────────
  useEffect(() => {
    if (condition) return; // already set

    const params = new URLSearchParams(window.location.search);
    const urlCondition = params.get('condition');
    const urlFreq      = parseInt(params.get('freq') ?? '5', 10);

    const resolved = CONDITIONS.includes(urlCondition)
      ? urlCondition
      : null;
    const resolvedFreq = [3, 5, 10, 15].includes(urlFreq) ? urlFreq : 5;

    setCondition(resolved, resolvedFreq);
  }, [condition, setCondition]);

  // ── Create session on backend once demographics are submitted ────────────
  async function handleDemographicsSubmit(demo) {
    setDemographics(demo);

    try {
      const res = await api.createSession({
        condition,
        frictionFrequency: useSessionStore.getState().frictionFrequency,
        demographics: demo,
      });
      setParticipantId(res.participantId);
      setSessionId(res.sessionId);
    } catch {
      // Offline / backend not yet running — continue with local-only session
      setParticipantId(`local-${Date.now()}`);
    }

    setPhase('feed');
  }

  // ── Phase rendering ───────────────────────────────────────────────────────
  function renderPhase() {
    switch (phase) {
      case 'consent':
        return <ConsentForm onConsent={() => setPhase('demographics')} />;

      case 'demographics':
        return <DemographicsForm onSubmit={handleDemographicsSubmit} />;

      case 'feed':
        return <FeedPage />;

      case 'memory':
        return <MemoryTestPage />;

      case 'survey':
        return <SurveyPage />;

      case 'done':
        return <ThankYouPage /> // SurveyPage shows the thank-you screen itself

      default:
        return <ConsentForm onConsent={() => setPhase('demographics')} />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-start justify-center">
      <DevBadge condition={condition} phase={phase} />
      {renderPhase()}
    </div>
  );
}
