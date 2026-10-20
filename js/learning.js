// The learning-style model: what a student can tell the tutor, and the
// ways they can tell it.
//
// A student shapes their lessons in four ways:
//  1. First visit to a course: a quick knowledge check ("How much do you
//     already know?") plus, the very first time, "How do you like to learn?"
//  2. The "Tweak this lesson" bar: one-tap rewrites (Simpler, More examples,
//     Shorter, ...). After a tweak, they can make it their default.
//  3. End-of-lesson feedback: "Too easy / Just right / Too hard" nudges the
//     difficulty for that course automatically.
//  4. The "My learning style" page: full control, a 3-question style quiz,
//     interests for analogies, and free-text notes to the tutor.

export const STYLE_OPTIONS = [
  { id: "step-by-step", icon: "🪜", label: "Step by step", desc: "Small, numbered steps. Nothing skipped." },
  { id: "examples-first", icon: "🧪", label: "Examples first", desc: "Show me a worked problem, then the rule." },
  { id: "visual", icon: "🗺", label: "Visual", desc: "Tables, diagrams, and pictures in my head." },
  { id: "story-analogy", icon: "💡", label: "Stories & analogies", desc: "Connect it to everyday life first." },
  { id: "big-picture", icon: "🔭", label: "Big picture", desc: "Why it matters, then the details." },
];

export const DEPTH_OPTIONS = [
  { id: "quick", label: "Quick", desc: "~5 min read" },
  { id: "standard", label: "Standard", desc: "~8 min read" },
  { id: "deep", label: "Deep dive", desc: "~12 min read" },
];

export const READING_OPTIONS = [
  { id: "simple", label: "Keep it simple", desc: "Everyday words, short sentences" },
  { id: "standard", label: "Standard", desc: "Typical AP level" },
  { id: "advanced", label: "Advanced", desc: "Concise and technical" },
];

export const EXTRA_OPTIONS = [
  { id: "realWorld", label: "Real-world connections" },
  { id: "mnemonics", label: "Memory tricks" },
  { id: "examTips", label: "AP exam tips" },
  { id: "commonMistakes", label: "Common mistakes" },
];

export const KNOWLEDGE_OPTIONS = [
  { id: "new", icon: "🌱", label: "Brand new", desc: "I haven't studied this yet." },
  { id: "some", icon: "🌿", label: "Some basics", desc: "I know a bit but have gaps." },
  { id: "comfortable", icon: "🌳", label: "Pretty comfortable", desc: "I get most of it; I want it solid." },
  { id: "review", icon: "🏁", label: "Exam review", desc: "I know it. Help me get a 5." },
];

// One-tap lesson rewrites. `remember` says how to fold the tweak into the
// saved profile if the student chooses "Make this my default".
export const TWEAKS = [
  { id: "simpler", label: "Simpler", icon: "🫧", remember: (p) => ({ reading: "simple" }) },
  { id: "harder", label: "Challenge me", icon: "🔥", remember: (p) => ({ reading: "advanced" }) },
  { id: "more-examples", label: "More examples", icon: "🧪", remember: (p) => ({ examples: Math.min(4, (p.examples || 2) + 1) }) },
  { id: "shorter", label: "Shorter", icon: "✂️", remember: (p) => ({ depth: p.depth === "deep" ? "standard" : "quick" }) },
  { id: "more-visual", label: "More visual", icon: "🗺", remember: () => ({ style: "visual" }) },
  { id: "different-angle", label: "Explain differently", icon: "🔄", remember: null },
];

export const DEFAULT_PROFILE = {
  style: "step-by-step",
  depth: "standard",
  reading: "standard",
  examples: 2,
  extras: { realWorld: true, mnemonics: true, examTips: true, commonMistakes: true },
  interests: "",
  notes: "",
};

export function withDefaults(profile) {
  return { ...DEFAULT_PROFILE, ...(profile || {}), extras: { ...DEFAULT_PROFILE.extras, ...(profile?.extras || {}) } };
}

// A short, stable fingerprint of everything that changes a lesson's content,
// used as part of the lesson cache key.
export function lessonFingerprint(profile, courseState, tweaks = []) {
  const p = withDefaults(profile);
  const parts = [
    p.style,
    p.depth,
    p.reading,
    p.examples,
    Object.entries(p.extras).filter(([, v]) => v).map(([k]) => k).sort().join(","),
    p.interests,
    p.notes,
    courseState?.knowledge,
    courseState?.difficultyShift || 0,
    (courseState?.strongUnits || []).join(","),
    courseState?.struggles || "",
    [...tweaks].sort().join(","),
  ].join("|");
  let h = 5381;
  for (let i = 0; i < parts.length; i++) h = ((h << 5) + h + parts.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const labelOf = (options, id) => options.find((o) => o.id === id)?.label ?? id;

// The 3-question style quiz on the profile page. Each answer votes for a style.
export const STYLE_QUIZ = [
  {
    q: "You're assembling new furniture. What do you do first?",
    a: [
      { text: "Follow the numbered instructions exactly", vote: "step-by-step" },
      { text: "Look at the picture of the finished piece", vote: "visual" },
      { text: "Watch someone else build one", vote: "examples-first" },
      { text: "Figure out what each part is for", vote: "big-picture" },
    ],
  },
  {
    q: "A friend explains a new game. What helps most?",
    a: [
      { text: "“It's like chess, but…”", vote: "story-analogy" },
      { text: "Playing a practice round together", vote: "examples-first" },
      { text: "A diagram of the board and moves", vote: "visual" },
      { text: "The goal first, then the rules", vote: "big-picture" },
    ],
  },
  {
    q: "When you get stuck on homework, you usually…",
    a: [
      { text: "Find a similar solved problem", vote: "examples-first" },
      { text: "Go back and redo each step slowly", vote: "step-by-step" },
      { text: "Draw it out or make a chart", vote: "visual" },
      { text: "Think of a real situation it's like", vote: "story-analogy" },
    ],
  },
];
