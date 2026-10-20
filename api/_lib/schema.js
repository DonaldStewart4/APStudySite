// JSON schema for a generated lesson, enforced with structured outputs
// (output_config.format). The browser renders each block type with its own
// component, e.g. "formula" blocks get LaTeX + explanation + "Explain further".

const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = (description) => ({ type: "string", description });
const strArr = (description) => ({ type: "array", items: { type: "string" }, description });

const blockTypes = [
  obj({
    type: { const: "text" },
    markdown: str("Markdown paragraph(s). Inline math only, as $...$."),
  }),
  obj({
    type: { const: "formula" },
    latex: str("Display LaTeX for the formula, without surrounding $$ delimiters."),
    name: str("Short name of the formula, e.g. 'Power Rule'."),
    explanation: str(
      "Plain-language explanation that comes right after the formula: what it says, when to use it. Markdown, inline $...$ allowed."
    ),
    variables: {
      type: "array",
      description: "Every symbol that appears in the formula and what it means.",
      items: obj({
        symbol: str("The symbol as inline LaTeX without $ delimiters, e.g. 'v_0'."),
        meaning: str("What the symbol stands for, with units if relevant."),
      }),
    },
  }),
  obj({
    type: { const: "example" },
    title: str("Short title for the worked example."),
    problem: str("The problem statement. Markdown, inline $...$ allowed."),
    steps: strArr("Each solution step as markdown. Put any display math in its own step as $$...$$."),
    answer: str("The final answer, stated clearly."),
  }),
  obj({
    type: { const: "callout" },
    tone: { type: "string", enum: ["tip", "warning", "exam", "memory"] },
    title: str("Short heading for the callout."),
    markdown: str("Callout body in markdown."),
  }),
  obj({
    type: { const: "analogy" },
    markdown: str("An everyday analogy that makes the idea click."),
  }),
  obj({
    type: { const: "table" },
    caption: str("What the table shows."),
    headers: strArr("Column headers."),
    rows: { type: "array", items: { type: "array", items: { type: "string" } } },
  }),
  obj({
    type: { const: "diagram" },
    caption: str("What the diagram shows."),
    mermaid: str(
      "Mermaid diagram source (flowchart, timeline, or sequence). Use simple node labels in double quotes, no LaTeX, no parentheses outside quotes."
    ),
  }),
  obj({
    type: { const: "check" },
    question: str("A quick 'pause and think' question to check understanding."),
    answer: str("The answer, revealed when the student taps."),
  }),
];

export const LESSON_SCHEMA = obj({
  title: str("Lesson title."),
  hook: str("One or two sentences on why this topic matters or is interesting."),
  objectives: strArr("2–4 things the student will be able to do after the lesson."),
  sections: {
    type: "array",
    items: obj({
      heading: str("Section heading."),
      blocks: { type: "array", items: { anyOf: blockTypes } },
    }),
  },
  keyTakeaways: strArr("3–5 one-line takeaways."),
  practice: {
    type: "array",
    description: "3–5 AP-style multiple-choice questions.",
    items: obj({
      question: str("Question stem. Markdown, inline $...$ allowed."),
      choices: strArr("Exactly four answer choices."),
      correctIndex: { type: "integer", description: "Index (0–3) of the correct choice." },
      explanation: str("Why the correct answer is right and the most tempting wrong one is wrong."),
    }),
  },
});
