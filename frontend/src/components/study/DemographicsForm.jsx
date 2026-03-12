/**
 * DemographicsForm.jsx
 *
 * Collects: age, gender, daily social media usage, and platforms used.
 * Mirrors the questionnaire described in Ruiz et al. (2024).
 */

import React, { useState } from 'react';
import useSessionStore from '../../store/sessionStore';

const PLATFORMS = ['Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Reddit', 'YouTube', 'Other'];

export default function DemographicsForm({ onSubmit }) {
  const { demographics, setDemographics } = useSessionStore();
  const [errors, setErrors] = useState({});

  function toggle(platform) {
    const cur = demographics.platformsUsed;
    setDemographics({
      platformsUsed: cur.includes(platform)
        ? cur.filter(p => p !== platform)
        : [...cur, platform],
    });
  }

  function validate() {
    const e = {};
    if (!demographics.age || demographics.age < 18 || demographics.age > 80)
      e.age = 'Please enter a valid age (18–80).';
    if (!demographics.gender)         e.gender = 'Please select an option.';
    if (!demographics.socialMediaUsage) e.usage = 'Please select an option.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    // const errs = validate();
    // if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit(demographics);
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const selectCls = inputCls + ' bg-white appearance-none';

  return (
    <div className="phone-frame flex flex-col">
      <div className="bg-blue-600 text-white px-5 pt-10 pb-5">
        <h1 className="text-xl font-bold">About You</h1>
        <p className="text-blue-100 text-xs mt-1">Step 1 of 4 · Demographics</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* Age */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number"
            min={18} max={80}
            value={demographics.age}
            onChange={e => setDemographics({ age: e.target.value })}
            placeholder="e.g. 23"
            className={inputCls}
          />
          {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            value={demographics.gender}
            onChange={e => setDemographics({ gender: e.target.value })}
            className={selectCls}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary / third gender</option>
            <option value="prefer-not">Prefer not to say</option>
          </select>
          {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
        </div>

        {/* Daily social media usage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How many hours per day do you typically use social media?
          </label>
          {[
            ['less-1h', 'Less than 1 hour'],
            ['1-2h', '1–2 hours'],
            ['2-4h', '2–4 hours'],
            ['more-4h', 'More than 4 hours'],
          ].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="radio"
                name="usage"
                value={val}
                checked={demographics.socialMediaUsage === val}
                onChange={() => setDemographics({ socialMediaUsage: val })}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
          {errors.usage && <p className="text-xs text-red-500 mt-1">{errors.usage}</p>}
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Which social media platforms do you use? <span className="text-gray-400">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95
                  ${demographics.platformsUsed.includes(p)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Normative dissociation question (from paper's general survey) */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            "I find myself spending more time on social media than initially intended."
          </p>
          <div className="flex justify-between gap-1">
            {['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'].map((lbl, i) => (
              <label key={i} className="flex-1 flex flex-col items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="overuse"
                  value={i + 1}
                  checked={demographics.overuse === String(i + 1)}
                  onChange={() => setDemographics({ overuse: String(i + 1) })}
                  className="accent-blue-500"
                />
                <span className="text-center text-[10px] text-gray-400 leading-tight whitespace-pre-line">{lbl}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-4 mt-2 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-base shadow-md active:scale-95 transition-all"
        >
          Continue →
        </button>
      </form>
    </div>
  );
}
