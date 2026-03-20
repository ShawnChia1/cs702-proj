/**
 * FeedPage.jsx
 *
 * Wraps either InfiniteScrollFeed (control) or FrictionFeed (interventions).
 * Shows a brief instruction screen first, then the feed.
 * On feed completion, advances the study phase to 'memory'.
 */

import React, { useState, useEffect } from 'react';
import InfiniteScrollFeed from '../components/feed/InfiniteScrollFeed';
import FrictionFeed from '../components/feed/FrictionFeed';
import { EXPOSURE_POSTS } from '../data/posts';
import useSessionStore from '../store/sessionStore';

export default function FeedPage() {
  const { condition, frictionFrequency, setPhase, startFeed, endFeed } = useSessionStore();
  const [step, setStep] = useState('instructions'); // 'instructions' | 'feed'

  useEffect(() => {
    // Shuffle post order once per session (between-subjects, not within)
    // Posts are already in a fixed order from posts.js; for ecological validity
    // a per-session shuffle could be applied here if desired.
  }, []);

  function handleStart() {
    startFeed();
    setStep('feed');
  }

  function handleComplete() {
    endFeed();
    setPhase('memory');
  }

  // ── Instructions screen ────────────────────────────────────────────────────
  if (step === 'instructions') {
    return (
      <div className="phone-frame flex flex-col">
        <div className="bg-indigo-600 text-white px-5 pt-10 pb-6">
          <h1 className="text-xl font-bold">Browse the Feed</h1>
          <p className="text-indigo-200 text-xs mt-1">Step 2 of 4</p>
        </div>

        <div className="flex-1 px-5 py-6 space-y-4 text-sm text-gray-700">
          <p className="leading-relaxed">
            You will now browse a social media feed containing <strong>30 posts</strong> about
            topics like art, cooking, technology, sports, and more.
          </p>
          <p className="leading-relaxed">
            Browse the feed <strong>as you normally would</strong> on social media.
            You will <em>not</em> be told when to stop — simply go through all the posts.
          </p>
          {condition !== 'control' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="font-medium text-yellow-800 mb-1">Note</p>
              <p className="text-yellow-700 text-xs">
                This feed includes occasional short interactions. Follow the on-screen
                prompts when they appear to continue browsing.
              </p>
            </div>
          )}
          <p className="leading-relaxed text-gray-500 text-xs">
            Your memory of the posts will be tested afterwards, but don't worry
            about memorising — just browse naturally.
          </p>
        </div>

        <div className="px-5 pb-8 pt-3 border-t border-gray-100">
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-base shadow-md active:scale-95 transition-all"
          >
            Start Browsing →
          </button>
        </div>
      </div>
    );
  }

  // ── Feed ──────────────────────────────────────────────────────────────────
  // Control: pure infinite scroll, no gates.
  // All friction conditions: same infinite scroll base + blocking overlay.
  // Reaction condition uses frictionFrequency=1 (gate after every post).
  if (condition === 'control') {
    return (
      <div className="phone-frame">
        <InfiniteScrollFeed
          posts={EXPOSURE_POSTS}
          onComplete={handleComplete}
        />
      </div>
    );
  }

  const effectiveFrequency = condition === 'reaction' ? 1 : frictionFrequency;

  return (
    <FrictionFeed
      posts={EXPOSURE_POSTS}
      condition={condition}
      frictionFrequency={effectiveFrequency}
      onComplete={handleComplete}
    />
  );
}
