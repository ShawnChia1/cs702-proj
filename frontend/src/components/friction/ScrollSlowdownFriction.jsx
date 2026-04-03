/**
 * ScrollSlowdownFriction.jsx — Adaptive slowdown indicator
 *
 * Non-blocking feedback shown while the feed temporarily reduces scroll speed.
 *
 * Props
 * ──────
 *  remainingMs – countdown for the active slowdown period
 *  totalMs     – total duration of the slowdown period
 */

import React from 'react';

export default function ScrollSlowdownFriction({ remainingMs, totalMs }) {
  const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
  const progress = totalMs > 0
    ? Math.max(0, Math.min(100, ((totalMs - remainingMs) / totalMs) * 100))
    : 0;

  return (
    <div className="pointer-events-none absolute inset-x-4 top-14 z-20">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-lg" aria-hidden="true">🐢</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">Slow down a moment</p>
            <p className="text-xs leading-relaxed text-amber-800">
              You are moving through the feed quickly, so scrolling is reduced briefly.
            </p>
          </div>
          <div className="text-xs font-semibold text-amber-700">{secondsLeft}s</div>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
