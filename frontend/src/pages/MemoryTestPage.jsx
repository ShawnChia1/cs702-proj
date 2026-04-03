/**
 * MemoryTestPage.jsx
 *
 * Shows a Stroop-task distractor (to reduce recency bias), then the memory test.
 * Calls onComplete to advance phase to 'survey'.
 */
import React, { useState, useEffect, useRef } from "react";
import MemoryTest from "../components/study/MemoryTest";
import { buildMemoryTestPool } from "../data/posts";
import useSessionStore from "../store/sessionStore";
import api from "../services/api";

// ── Stroop task ────────────────────────────────────────────────────────────────
const STROOP_ITEMS = [
  { word: "RED", inkColor: "text-blue-500" },
  { word: "BLUE", inkColor: "text-green-500" },
  { word: "GREEN", inkColor: "text-red-500" },
  { word: "YELLOW", inkColor: "text-purple-500" },
  { word: "PURPLE", inkColor: "text-yellow-500" },
  { word: "ORANGE", inkColor: "text-blue-600" },
  { word: "PINK", inkColor: "text-green-600" },
  { word: "BLACK", inkColor: "text-orange-500" },
];

const STROOP_DURATION_S = 30; // seconds

function StroopTask({ onDone }) {
  const [current, setCurrent] = useState(
    () => STROOP_ITEMS[Math.floor(Math.random() * STROOP_ITEMS.length)],
  );
  const [secondsLeft, setSecondsLeft] = useState(STROOP_DURATION_S);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onDone(score);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, score, onDone]);

  function handleAnswer(colorName) {
    const correct =
      colorName.toLowerCase() === current.inkColor.match(/text-(\w+)-/)?.[1];
    if (correct) {
      setScore((s) => s + 1);
	  setSecondsLeft(prev => prev-5)
    }
    setCurrent(STROOP_ITEMS[Math.floor(Math.random() * STROOP_ITEMS.length)]);
  }

  const COLORS = [
    "Red",
    "Blue",
    "Green",
    "Yellow",
    "Purple",
    "Orange",
    "Pink",
    "Black",
  ];

  return (
    <div className="phone-frame flex flex-col">
      <div className="bg-orange-500 text-white px-5 pt-8 pb-4">
        <h1 className="text-lg font-bold">Quick Task</h1>
        <p className="text-orange-100 text-xs mt-0.5">
          Name the INK COLOR — not the word itself
        </p>
        <div className="mt-3 h-1.5 bg-orange-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-1000"
            style={{ width: `${(secondsLeft / STROOP_DURATION_S) * 100}%` }}
          />
        </div>
        <p className="text-orange-100 text-xs mt-1">
          {secondsLeft}s remaining · {score} correct
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <div
          className={`text-5xl font-black mb-10 ${current.inkColor}`}
          aria-label={`Word: ${current.word}`}
        >
          {current.word}
        </div>

        <div className="grid grid-cols-4 gap-2 w-full">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleAnswer(c)}
              className="py-2.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 active:scale-95 transition-all"
            >
              {c}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          Tap the colour of the ink, not the meaning of the word.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MemoryTestPage() {
  const { sessionId, postsViewed, setMemoryTestPool, setPhase } = useSessionStore();
  const [step, setStep] = useState("stroop");

  function handleStroopDone() {
    const pool = buildMemoryTestPool(postsViewed);
    setMemoryTestPool(pool);
    setStep("test");
  }

  async function handleTestComplete(responses) {
    try {
      if (sessionId) {
        await api.submitMemoryTest(sessionId, responses);
      }
      setPhase("survey");
    } catch (err) {
      console.error("submitMemoryTest failed:", err);
      setPhase("survey");
    }
  }

  if (step === "stroop") {
    return <StroopTask onDone={handleStroopDone} />;
  }

  return <MemoryTest onComplete={handleTestComplete} />;
}
