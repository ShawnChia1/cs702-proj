/**
 * FrictionFeed.jsx — Intervention conditions
 *
 * Identical to InfiniteScrollFeed in every way EXCEPT:
 *   – Most intervention conditions show a blocking overlay after every N posts.
 *   – The slowdown condition does not block; it temporarily dampens scroll
 *     input once the user has skimmed enough posts and is still scrolling fast.
 *   – Modal conditions lock the scroll container until the interaction is
 *     completed, then dismiss and resume normal scrolling.
 *
 * This ensures the only difference between control and intervention groups
 * is the friction mechanism — not the feed format.
 *
 * Friction frequency
 * ──────────────────
 *  frictionFrequency = 1  → gate after every single post  (reaction condition)
 *  frictionFrequency = 5  → gate after every 5th post     (default)
 *                           or, for slowdown, allow rapid-scroll damping
 *                           once at least 5 posts have been skimmed
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
import ScrollSlowdownFriction from "../friction/ScrollSlowdownFriction";
import useSessionStore from "../../store/sessionStore";
import useScrollTracker from "../../hooks/useScrollTracker";

const POSTS_PER_PAGE = 5;
const SLOWDOWN_DURATION_MS = 2500;
const SLOWDOWN_FACTOR = 0.35;
const SLOWDOWN_VELOCITY_THRESHOLD = 1.1;

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
  const [slowdownRemainingMs, setSlowdownRemainingMs] = useState(0);

  const sentinelRef = useRef(null);
  const completedRef = useRef(false);
  const frictionShownTsRef = useRef(null);
  const containerRef2 = useRef(null); // for locking scroll
  const slowdownTimerRef = useRef(null);
  const slowdownTickRef = useRef(null);
  const slowdownActiveRef = useRef(false);
  const latestScrollRef = useRef({ direction: "down", velocityPx: 0 });

  // Ref-counter gate: counts posts viewed since the last friction gate.
  // Lives entirely in refs so it is never stale inside callbacks.
  const postsSinceGateRef = useRef(0);
  const frictionActiveRef = useRef(false); // mirrors modal overlays for use in callbacks

  // Keep frictionFrequency accessible inside the dwell callback without
  // re-creating the callback every time the prop changes.
  const freqRef = useRef(frictionFrequency);
  useEffect(() => {
    freqRef.current = frictionFrequency;
  }, [frictionFrequency]);

  const isSlowdownCondition = condition === "slowdown";
  const slowdownVisible = isSlowdownCondition && slowdownRemainingMs > 0;

  const clearSlowdownTimers = useCallback(() => {
    if (slowdownTimerRef.current) {
      clearTimeout(slowdownTimerRef.current);
      slowdownTimerRef.current = null;
    }
    if (slowdownTickRef.current) {
      clearInterval(slowdownTickRef.current);
      slowdownTickRef.current = null;
    }
  }, []);

  const finishSlowdown = useCallback(
    (action = "slowdown_elapsed") => {
      clearSlowdownTimers();
      if (!slowdownActiveRef.current || !frictionShownTsRef.current) return;

      logFrictionDone({
        frictionType: condition,
        shownTs: frictionShownTsRef.current,
        action,
      });
      frictionShownTsRef.current = null;
      slowdownActiveRef.current = false;
      setSlowdownRemainingMs(0);
    },
    [clearSlowdownTimers, condition, logFrictionDone],
  );

  const activateSlowdown = useCallback(() => {
    if (slowdownActiveRef.current) return;

    postsSinceGateRef.current = 0;
    frictionShownTsRef.current = Date.now();
    slowdownActiveRef.current = true;
    setSlowdownRemainingMs(SLOWDOWN_DURATION_MS);
    logFrictionShown({
      frictionType: condition,
      triggerPostIndex: postsViewed.length + 1,
    });

    clearSlowdownTimers();
    slowdownTickRef.current = setInterval(() => {
      setSlowdownRemainingMs(
        Math.max(0, SLOWDOWN_DURATION_MS - (Date.now() - frictionShownTsRef.current)),
      );
    }, 100);
    slowdownTimerRef.current = setTimeout(
      () => finishSlowdown(),
      SLOWDOWN_DURATION_MS,
    );
  }, [
    clearSlowdownTimers,
    condition,
    finishSlowdown,
    logFrictionShown,
    postsViewed.length,
  ]);

  // ── Scroll telemetry ───────────────────────────────────────────────────────
  const handleScroll = useCallback((data) => {
    latestScrollRef.current = data;
    logScroll(data);
  }, [logScroll]);
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

      if (isSlowdownCondition) {
        if (slowdownActiveRef.current) return;

        postsSinceGateRef.current += 1;
        const latestScroll = latestScrollRef.current;
        const hasBrowsedEnoughPosts = postsSinceGateRef.current >= freqRef.current;
        const isScrollingFast =
          latestScroll.direction === "down"
          && latestScroll.velocityPx >= SLOWDOWN_VELOCITY_THRESHOLD;

        if (hasBrowsedEnoughPosts && isScrollingFast) {
          activateSlowdown();
        }
        return;
      }

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
          triggerPostIndex: postsViewed.length + 1,
        });
        setShowFriction(true);
      }
    },
    [
      activateSlowdown,
      condition,
      currentFriction,
      isSlowdownCondition,
      logFrictionShown,
      logPostView,
      postsViewed.length,
    ],
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
  }, [postsViewed.length, posts.length, onComplete]);

  // ── Lock / unlock scroll while friction is active ─────────────────────────
  useEffect(() => {
    if (isSlowdownCondition) return;

    const el = containerRef2.current;
    if (!el) return;
    el.style.overflow = showFriction ? "hidden" : "";
    el.style.pointerEvents = showFriction ? "none" : "";
  }, [isSlowdownCondition, showFriction]);

  // ── Slow scrolling input while slowdown friction is active ────────────────
  useEffect(() => {
    const el = containerRef2.current;
    if (!el || !isSlowdownCondition) return;

    let lastTouchY = null;
    let isProgrammaticScroll = false;
    let lastObservedScrollTop = el.scrollTop;

    const syncScrollTop = (nextScrollTop) => {
      isProgrammaticScroll = true;
      el.scrollTop = Math.max(0, nextScrollTop);
      requestAnimationFrame(() => {
        lastObservedScrollTop = el.scrollTop;
        isProgrammaticScroll = false;
      });
    };

    const applyDelta = (delta) => {
      if (Math.abs(delta) < 0.5) return;
      const factor = delta > 0 ? SLOWDOWN_FACTOR : 1;
      syncScrollTop(el.scrollTop + (delta * factor));
    };

    const handleWheel = (event) => {
      if (!slowdownActiveRef.current || event.deltaY <= 0) return;
      event.preventDefault();
      applyDelta(event.deltaY);
    };

    const handleTouchStart = (event) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event) => {
      const currentY = event.touches[0]?.clientY;
      if (currentY == null) return;
      if (lastTouchY == null) {
        lastTouchY = currentY;
        return;
      }

      lastTouchY = currentY;
    };

    const handleTouchEnd = () => {
      lastTouchY = null;
    };

    const handleNativeScroll = () => {
      if (isProgrammaticScroll) {
        lastObservedScrollTop = el.scrollTop;
        return;
      }
      if (!slowdownActiveRef.current) {
        lastObservedScrollTop = el.scrollTop;
        return;
      }

      const delta = el.scrollTop - lastObservedScrollTop;
      if (delta > 0) {
        syncScrollTop(lastObservedScrollTop + (delta * SLOWDOWN_FACTOR));
        return;
      }
      lastObservedScrollTop = el.scrollTop;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("scroll", handleNativeScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("scroll", handleNativeScroll);
    };
  }, [isSlowdownCondition]);

  useEffect(() => () => {
    clearSlowdownTimers();
    if (!slowdownActiveRef.current || !frictionShownTsRef.current) return;

    logFrictionDone({
      frictionType: condition,
      shownTs: frictionShownTsRef.current,
      action: "feed_unmounted",
    });
    frictionShownTsRef.current = null;
    slowdownActiveRef.current = false;
  }, [clearSlowdownTimers, condition, logFrictionDone]);

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
        style={{ touchAction: "pan-y" }}
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

      {slowdownVisible && (
        <ScrollSlowdownFriction
          remainingMs={slowdownRemainingMs}
          totalMs={SLOWDOWN_DURATION_MS}
        />
      )}
    </div>
  );
}
