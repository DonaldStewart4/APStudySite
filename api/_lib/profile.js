// Server-side validation of the learner profile sent by the browser.
// Everything the client sends is untrusted: enums are checked against
// allow-lists and free text is trimmed and length-capped before it goes
// into a prompt.

export const STYLES = {
  "step-by-step": "Break every idea into small numbered steps. Never skip a step, even an 'obvious' one.",
  "examples-first": "Lead with a concrete worked example, then pull the general rule out of it.",
  visual: "Favor tables, comparison grids, flow diagrams, and vivid mental pictures. Describe what things would look like.",
  "story-analogy": "Anchor each idea in an everyday analogy or short story before formalizing it.",
  "big-picture": "Start with why the idea matters and how it connects to the rest of the course, then zoom into details.",
};

export const DEPTHS = {
  quick: "Keep it tight: about 500–800 words. Only the essentials for this topic.",
  standard: "Aim for about 900–1400 words. Cover the topic fully without padding.",
  deep: "Go deep: about 1500–2200 words, including edge cases and the reasoning behind the rules.",
};

export const READING = {
  simple: "Write for someone who finds this subject hard: short sentences, everyday words, define every term the first time it appears.",
  standard: "Write clearly for a typical AP student. Define technical terms when first used.",
  advanced: "The student is strong: you can be more concise and use technical vocabulary freely.",
};

export const KNOWLEDGE = {
  new: "Brand new to this subject. Assume no prior knowledge of the course.",
  some: "Knows some basics of this subject but has gaps.",
  comfortable: "Comfortable with most of this subject; wants to solidify understanding.",
  review: "Reviewing for the exam; knows the material and wants exam-focused refreshers.",
};

const EXTRAS = ["realWorld", "mnemonics", "examTips", "commonMistakes"];

function pick(value, allowed, fallback) {
  return Object.hasOwn(allowed, value) ? value : fallback;
}

function text(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function sanitizeProfile(raw = {}) {
  const extras = {};
  for (const key of EXTRAS) extras[key] = raw?.extras?.[key] !== false;
  return {
    style: pick(raw.style, STYLES, "step-by-step"),
    depth: pick(raw.depth, DEPTHS, "standard"),
    reading: pick(raw.reading, READING, "standard"),
    examples: Math.min(4, Math.max(1, Number.parseInt(raw.examples, 10) || 2)),
    extras,
    interests: text(raw.interests, 200),
    notes: text(raw.notes, 500),
  };
}

export function sanitizeCourseState(raw = {}) {
  return {
    knowledge: pick(raw.knowledge, KNOWLEDGE, "some"),
    strongUnits: Array.isArray(raw.strongUnits)
      ? raw.strongUnits.filter((n) => Number.isInteger(n) && n >= 0 && n < 20).slice(0, 20)
      : [],
    struggles: text(raw.struggles, 300),
    // Signal from the "too easy / too hard" buttons: -2 (much easier) .. +2 (much harder)
    difficultyShift: Math.max(-2, Math.min(2, Number.parseInt(raw.difficultyShift, 10) || 0)),
  };
}

// One-off adjustments from the quick-tweak bar on a lesson ("simpler", "more examples", ...)
export const TWEAKS = {
  simpler: "Make this version noticeably simpler than usual: fewer terms, more plain-language explanation.",
  harder: "Make this version more challenging: tougher examples and more exam-level nuance.",
  "more-examples": "Include extra worked examples, more than usual.",
  shorter: "Make this version shorter than usual; keep only what matters most.",
  "more-visual": "Lean hard on tables, diagrams, and visual descriptions.",
  "different-angle": "Explain it from a completely different angle than a textbook would, using a fresh analogy.",
};

export function sanitizeTweaks(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((t) => Object.hasOwn(TWEAKS, t)))].slice(0, 3);
}
