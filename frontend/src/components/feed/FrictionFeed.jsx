/**
 * FrictionFeed.jsx — Intervention conditions
 *
 * Identical to InfiniteScrollFeed in every way EXCEPT:
 *   – After every N posts are scrolled past, a blocking overlay (the friction
 *     component) appears on top of the feed.
 *   – While the overlay is visible, the scroll container is locked so the
 *     user cannot continue until the interaction is completed.
 *   – Once the user finishes the friction interaction, the overlay dismisses
 *     and scrolling resumes normally.
 *
 * This ensures the only difference between control and intervention groups
 * is the friction mechanism — not the feed format.
 *
 * Friction frequency
 * ──────────────────
 *  frictionFrequency = 1  → gate after every single post  (reaction condition)
 *  frictionFrequency = 5  → gate after every 5th post     (default)
 *  etc.
 *
 * Gate trigger
 * ────────────
 *  A local ref counter (postsSinceGateRef) is incremented inside handleDwellEnd
 *  each time a post scrolls out of view.  When it reaches frictionFrequency the
 *  counter resets to 0 and the friction overlay is shown.  This avoids the
 *  React useEffect timing pitfall where the modulo check could re-trigger on
 *  the same postsViewed.length value after the overlay dismisses.
 */

import React, { useCallback, useState, useEffect, useRef } from "react";
import PostCard from "../PostCard";
import ReactionFriction from "../friction/ReactionFriction";
import ButtonToggleFriction from "../friction/ButtonToggleFriction";
import ContentFeedbackFriction from "../friction/ContentFeedbackFriction";
import PauseScreenFriction from "../friction/PauseScreenFriction";
import MiniGameFriction from "../friction/MiniGameFriction";
import useSessionStore, { assignCondition } from "../../store/sessionStore";
import useScrollTracker from "../../hooks/useScrollTracker";

const POSTS_PER_PAGE = 5;

const FRICTION_COMPONENT = {
  reaction: ReactionFriction,
  button: ButtonToggleFriction,
  feedback: ContentFeedbackFriction,
  pause: PauseScreenFriction,
  minigame: MiniGameFriction,
};

function getRandomFriction() {
  const keys = Object.keys(FRICTION_COMPONENT);
  return keys[Math.floor(Math.random() * keys.length)];
}

export default function FrictionFeed({
  posts,
  condition,
  frictionFrequency,
  onComplete,
}) {
  const {
    logPostView,
    logScroll,
    logFrictionShown,
    logFrictionDone,
    postsViewed,
  } = useSessionStore();

  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);
  const [showFriction, setShowFriction] = useState(false);
  const [currentFriction, setCurrentFriction] = useState(condition);

  const sentinelRef = useRef(null);
  const completedRef = useRef(false);
  const frictionShownTsRef = useRef(null);
  const containerRef2 = useRef(null); // for locking scroll

  // Ref-counter gate: counts posts viewed since the last friction gate.
  // Lives entirely in refs so it is never stale inside callbacks.
  const postsSinceGateRef = useRef(0);
  const frictionActiveRef = useRef(false); // mirrors showFriction for use in callbacks

  // Keep frictionFrequency accessible inside the dwell callback without
  // re-creating the callback every time the prop changes.
  const freqRef = useRef(frictionFrequency);
  useEffect(() => {
    freqRef.current = frictionFrequency;
  }, [frictionFrequency]);

  // ── Scroll telemetry ───────────────────────────────────────────────────────
  const handleScroll = useCallback((data) => logScroll(data), [logScroll]);
  const scrollRef = useScrollTracker(handleScroll);

  // Merge both refs onto the same container div
  function setContainerRef(el) {
    scrollRef.current = el;
    containerRef2.current = el;
  }

  // ── Dwell-time telemetry + gate trigger ────────────────────────────────────
  const handleDwellEnd = useCallback(
    (stats) => {
      logPostView(stats);

      // Don't count posts that dwell-end while the overlay is already showing
      // (can happen if the user somehow triggers the observer during lock).
      if (frictionActiveRef.current) return;

      postsSinceGateRef.current += 1;

      if (postsSinceGateRef.current >= freqRef.current) {
        postsSinceGateRef.current = 0;
        frictionActiveRef.current = true;
        if (!condition) setCurrentFriction(getRandomFriction());
        frictionShownTsRef.current = Date.now();
        // postsViewed count from store is fine for telemetry (logged async)
        logFrictionShown({
          frictionType: currentFriction,
          triggerPostCount: postsViewed.length + 1,
        });
        setShowFriction(true);
      }
    },
    [logPostView, logFrictionShown, currentFriction, postsViewed.length],
  );

  // ── Infinite-load sentinel ─────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + POSTS_PER_PAGE, posts.length),
          );
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [posts.length]);

  // ── End-of-feed completion ────────────────────────────────────────────────
  useEffect(() => {
    if (!completedRef.current && postsViewed.length >= posts.length-2) {
      const timer = setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    console.log(postsViewed.length)
  }, [postsViewed.length, posts.length, onComplete]);

  // ── Lock / unlock scroll while friction is active ─────────────────────────
  useEffect(() => {
    const el = containerRef2.current;
    if (!el) return;
    el.style.overflow = showFriction ? "hidden" : "";
    el.style.pointerEvents = showFriction ? "none" : "";
  }, [showFriction]);

  // ── Friction completion ────────────────────────────────────────────────────
  function handleFrictionComplete(action) {
    logFrictionDone({
      frictionType: currentFriction,
      shownTs: frictionShownTsRef.current,
      action,
    });
    frictionActiveRef.current = false;
    setShowFriction(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const FrictionComp = FRICTION_COMPONENT[currentFriction] ?? null;
  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div className="relative phone-frame">
      {/* Scrollable feed — identical to InfiniteScrollFeed */}
      <div
        ref={setContainerRef}
        className="feed-container"
        role="feed"
        aria-label="Social media feed"
      >
        {/* Progress bar */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Discover</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="progress-bar rounded-full"
                style={{
                  width: `${(postsViewed.length / posts.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {postsViewed.length}/{posts.length}
            </span>
          </div>
        </div>

        {/* Post stream */}
        {visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} onDwellEnd={handleDwellEnd} />
        ))}

        {/* Infinite-load sentinel */}
        {visibleCount < posts.length && (
          <div
            ref={sentinelRef}
            className="h-16 flex items-center justify-center"
          >
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* End-of-feed notice */}
        {visibleCount >= posts.length && (
          <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-sm font-medium">You've seen all posts</p>
            <p className="text-xs">Moving to the next step…</p>
          </div>
        )}
      </div>

      {/* Friction overlay — fixed on top, pointer-events restored so the
          overlay itself is still interactive even though the feed is locked */}
      {showFriction && FrictionComp && (
        <div style={{ pointerEvents: "auto" }}>
          <FrictionComp onComplete={handleFrictionComplete} />
        </div>
      )}
    </div>
  );
}
