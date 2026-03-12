/**
 * Survey.jsx
 *
 * Post-session questionnaire.  Combines:
 *   1. General Survey  – matches Ruiz et al. paper appendix (Q1–Q5)
 *   2. Interface-specific survey – adapts the Reaction-Based Interface Survey
 *      from the paper to apply to whichever condition the participant was in.
 *
 * All items use 5-point Likert scales (Strongly Disagree → Strongly Agree).
 * An open-ended improvements question is included as the final item.
 */

import React, { useState } from 'react';
import useSessionStore from '../../store/sessionStore';

const LIKERT = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'];

const GENERAL_QUESTIONS = [
  { id: 'g1', text: 'I find myself spending more time on social media than I initially intended.' },
  { id: 'g2', text: 'I lose track of time when using social media platforms.' },
  { id: 'g3', text: 'It is important to me to recall the content I find valuable on social media.' },
  { id: 'g4', text: 'At the end of the day, I remember most of the content I consume on social media.' },
  { id: 'g5', text: 'I use social media without really paying attention to what I am doing.' },
];

const INTERFACE_QUESTIONS = [
  { id: 'i1', text: 'I was motivated to interact with the friction elements.' },
  { id: 'i2', text: 'It was frustrating having to interact before going to the next post.' },
  { id: 'i3', text: 'I felt demotivated to continue using the app when friction appeared.' },
  { id: 'i4', text: 'The friction made me pay more attention to the content of the posts.' },
  { id: 'i5', text: 'I would like to see more apps having this feature.' },
  { id: 'i6', text: 'I found the interface easy to interact with.' },
  { id: 'i7', text: 'The screen layout was well organised.' },
];

function LikertItem({ question, value, onChange }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 mb-3">
      <p className="text-sm text-gray-800 mb-3 leading-relaxed">{question.text}</p>
      <div className="flex justify-between gap-1">
        {LIKERT.map((lbl, i) => {
          const v = String(i + 1);
          const active = value === v;
          return (
            <label key={i} className="flex-1 flex flex-col items-center gap-1 cursor-pointer">
              <div
                onClick={() => onChange(question.id, v)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 cursor-pointer
                  ${active ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-300 bg-white'}`}
              >
                {active && <div className="w-3 h-3 bg-white rounded-full" />}
              </div>
              <span className="text-center text-[9px] text-gray-400 leading-tight whitespace-pre-line">{lbl}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function Survey({ onSubmit }) {
  const { surveyResponses, setSurveyResponse, condition } = useSessionStore();
  const [openEnded, setOpenEnded] = useState('');
  const [submitError, setSubmitError] = useState('');

  const isControl = condition === 'control';

  function handleChange(qId, val) {
    setSurveyResponse(qId, val);
  }

  function handleSubmit() {
    // Require all Likert items
    const required = [...GENERAL_QUESTIONS, ...(isControl ? [] : INTERFACE_QUESTIONS)];
    const missing  = required.filter(q => !surveyResponses[q.id]);
    // if (missing.length) {
    //   setSubmitError('Please answer all questions before submitting.');
    //   return;
    // }
    setSurveyResponse('open_ended', openEnded);
    onSubmit({ ...surveyResponses, open_ended: openEnded });
  }

  return (
    <div className="phone-frame flex flex-col">
      {/* Header */}
      <div className="bg-green-600 text-white px-5 pt-8 pb-4">
        <h1 className="text-lg font-bold">Your Experience</h1>
        <p className="text-green-200 text-xs mt-0.5">Final step · Survey</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">

        {/* General questions */}
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          General
        </h2>
        {GENERAL_QUESTIONS.map(q => (
          <LikertItem
            key={q.id}
            question={q}
            value={surveyResponses[q.id]}
            onChange={handleChange}
          />
        ))}

        {/* Interface questions (not shown to control group) */}
        {!isControl && (
          <>
            <h2 className="text-sm font-semibold text-gray-700 mt-5 mb-3 uppercase tracking-wide">
              About the Interface
            </h2>
            {INTERFACE_QUESTIONS.map(q => (
              <LikertItem
                key={q.id}
                question={q}
                value={surveyResponses[q.id]}
                onChange={handleChange}
              />
            ))}
          </>
        )}

        {/* Open-ended */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Are there any changes or improvements you would recommend regarding the interface?
            <span className="text-gray-400"> (optional)</span>
          </label>
          <textarea
            value={openEnded}
            onChange={e => setOpenEnded(e.target.value)}
            rows={4}
            placeholder="Your thoughts…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>

        {submitError && (
          <p className="text-xs text-red-500 mt-2">{submitError}</p>
        )}

        <button
          onClick={handleSubmit}
          className="w-full mt-5 mb-8 py-4 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-semibold text-base shadow-md active:scale-95 transition-all"
        >
          Submit &amp; Finish
        </button>
      </div>
    </div>
  );
}
