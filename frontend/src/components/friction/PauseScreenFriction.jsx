/**
 * PauseScreenFriction.jsx — Soft friction modality: timed reflective pause
 *
 * Displays a neutral quote for a fixed duration (default 7 s).
 * No user input is required — the overlay auto-dismisses.
 * Provides a reflective break without demanding active interaction.
 *
 * Props
 * ──────
 *  onComplete   – (action: 'pause_ended') => void
 *  duration     – pause length in seconds (default 7)
 */

import React, { useEffect, useState } from 'react';

const QUOTES = [
  { text: 'The present moment is the only moment available to us, and it is the door to all moments.', author: 'Thich Nhat Hanh' },
  { text: 'Awareness is the greatest agent for change.', author: 'Eckhart Tolle' },
  { text: 'Almost everything will work again if you unplug it for a few minutes.', author: 'Anne Lamott' },
  { text: 'The quieter you become, the more you are able to hear.', author: 'Rumi' },
  { text: 'Not everything that can be counted counts, and not everything that counts can be counted.', author: 'William Bruce Cameron' },
  { text: 'Slow down and everything you are chasing will come around and catch you.', author: 'John De Paola' },
  { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'What we pay attention to, and how we pay attention, determines the texture of experience.', author: 'Mihaly Csikszentmihalyi' },
];

function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

export default function PauseScreenFriction({ onComplete, duration = 3 }) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [quote] = useState(randomQuote);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onComplete('pause_ended');
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onComplete]);

  const progress = ((duration - secondsLeft) / duration) * 100;

  return (
    <div className="friction-overlay" role="dialog" aria-modal="true" aria-label="Pause moment">
      <div className="friction-card">
        {/* Countdown ring */}
        <div className="flex justify-center mb-5">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke="#3b82f6" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-blue-600">
              {secondsLeft}
            </span>
          </div>
        </div>

        {/* Quote */}
        <blockquote className="text-center">
          <p className="text-sm text-gray-700 leading-relaxed italic">
            "{quote.text}"
          </p>
          <footer className="mt-2 text-xs text-gray-400 font-medium">
            — {quote.author}
          </footer>
        </blockquote>

        <p className="text-center text-xs text-gray-400 mt-4">
          Continuing automatically in {secondsLeft}s…
        </p>
      </div>
    </div>
  );
}
