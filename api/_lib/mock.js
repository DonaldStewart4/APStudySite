// Offline demo responses, used when MOCK_AI=1 (npm run dev:mock).
// Lets you click through the whole site and see every lesson block type
// without an API key or spending tokens.

import { startNdjson, send } from "./claude.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function drip(res, text, chunk = 60, delay = 12) {
  startNdjson(res);
  for (let i = 0; i < text.length; i += chunk) {
    send(res, { t: "delta", d: text.slice(i, i + chunk) });
    await sleep(delay);
  }
  send(res, { t: "done", text });
  res.end();
}

export function streamMockLesson(res, course, topic) {
  const lesson = {
    title: topic.title,
    hook: `This is a **demo lesson** for ${course.name}, topic ${topic.id}. Real lessons are written by Claude for your learning style. Add an API key to turn them on.`,
    objectives: [
      "See how every lesson block looks and animates",
      "Try the “Explain further” button under a formula",
      "Answer the practice questions at the end",
    ],
    sections: [
      {
        heading: "The big idea",
        blocks: [
          {
            type: "text",
            markdown:
              "Every lesson starts with plain language. Small bits of math like $x^2$ or $v = 3\\text{ m/s}$ stay inline, while anything bigger gets its own formula card.",
          },
          {
            type: "analogy",
            markdown:
              "Think of a derivative like a car's speedometer: it doesn't tell you where you are, only how fast your position is changing *right now*.",
          },
          {
            type: "formula",
            name: "Limit definition of the derivative",
            latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
            explanation:
              "Take two points on the curve that are $h$ apart, find the slope between them, then slide them together until $h$ is basically zero. The slope you end up with is the slope **at a single point**.",
            variables: [
              { symbol: "f'(x)", meaning: "the derivative: the instantaneous rate of change at $x$" },
              { symbol: "h", meaning: "a tiny horizontal gap between the two points" },
              { symbol: "f(x+h) - f(x)", meaning: "the rise between the two points" },
            ],
          },
          {
            type: "check",
            question: "If $f(x) = 5$ (a flat line), what should $f'(x)$ be?",
            answer: "$0$, because a flat line never rises, so its slope is zero everywhere.",
          },
        ],
      },
      {
        heading: "Seeing it",
        blocks: [
          {
            type: "diagram",
            caption: "How the definition works, step by step",
            mermaid:
              'flowchart LR\n  A["Pick two points h apart"] --> B["Find slope between them"]\n  B --> C["Shrink h toward 0"]\n  C --> D["Slope at one point = f\'(x)"]',
          },
          {
            type: "table",
            caption: "Secant slope vs. tangent slope",
            headers: ["", "Secant line", "Tangent line"],
            rows: [
              ["Touches the curve at", "Two points", "One point"],
              ["Slope means", "Average rate of change", "Instantaneous rate of change"],
              ["Formula", "$\\frac{f(b)-f(a)}{b-a}$", "$f'(a)$"],
            ],
          },
          {
            type: "callout",
            tone: "warning",
            title: "Common mistake",
            markdown: "Plugging in $h = 0$ right away gives $\\frac{0}{0}$. You have to simplify **first**, then take the limit.",
          },
        ],
      },
      {
        heading: "Worked example",
        blocks: [
          {
            type: "example",
            title: "Derivative of x²",
            problem: "Use the limit definition to find $f'(x)$ for $f(x) = x^2$.",
            steps: [
              "Write the difference quotient: $\\frac{(x+h)^2 - x^2}{h}$",
              "Expand the top: $\\frac{x^2 + 2xh + h^2 - x^2}{h} = \\frac{2xh + h^2}{h}$",
              "Cancel an $h$: $2x + h$",
              "Let $h \\to 0$: $$\\lim_{h\\to 0}(2x + h) = 2x$$",
            ],
            answer: "$f'(x) = 2x$",
          },
          {
            type: "formula",
            name: "Power Rule",
            latex: "\\frac{d}{dx}\\left[x^n\\right] = n\\,x^{n-1}",
            explanation:
              "Bring the exponent down in front, then lower the exponent by one. It's the shortcut that skips the limit work above.",
            variables: [
              { symbol: "n", meaning: "any real-number exponent" },
              { symbol: "\\frac{d}{dx}", meaning: "“take the derivative with respect to $x$”" },
            ],
          },
          {
            type: "callout",
            tone: "exam",
            title: "On the AP exam",
            markdown: "You'll often be asked to *recognize* a limit as a derivative. For example, $\\lim_{h\\to0}\\frac{\\sin(\\pi+h)-\\sin\\pi}{h}$ is just $\\cos\\pi = -1$.",
          },
          {
            type: "callout",
            tone: "memory",
            title: "Memory trick",
            markdown: "**“Down and minus one.”** The exponent comes down, then drops by one.",
          },
        ],
      },
    ],
    keyTakeaways: [
      "A derivative is an instantaneous rate of change: the slope at one point.",
      "The limit definition shrinks a secant line into a tangent line.",
      "The power rule is the everyday shortcut: $\\frac{d}{dx}x^n = nx^{n-1}$.",
    ],
    practice: [
      {
        question: "What is $\\frac{d}{dx}\\left[x^5\\right]$?",
        choices: ["$5x^4$", "$x^4$", "$5x^5$", "$4x^5$"],
        correctIndex: 0,
        explanation: "Bring the 5 down and subtract one from the exponent: $5x^4$. Choice B forgets to bring the exponent down.",
      },
      {
        question: "Which describes the slope of a tangent line?",
        choices: ["Average rate of change", "Instantaneous rate of change", "Total change", "Area under the curve"],
        correctIndex: 1,
        explanation: "The tangent slope is the rate of change at a single instant. The average rate belongs to a secant line.",
      },
      {
        question: "If $f(x) = 7$, then $f'(3) =$",
        choices: ["$7$", "$21$", "$3$", "$0$"],
        correctIndex: 3,
        explanation: "A constant function is flat, so its slope is $0$ everywhere.",
      },
    ],
  };
  return drip(res, JSON.stringify(lesson));
}

export function streamMockExplain(res, latex) {
  const text = `Here's the intuition: the formula $${latex.length > 60 ? "above" : latex}$ is built so each piece has one job.\n\nTry a tiny example. With $f(x)=x^2$ at $x=3$ and $h=0.1$:\n\n$$\\frac{(3.1)^2 - 3^2}{0.1} = \\frac{0.61}{0.1} = 6.1$$\n\nShrink $h$ to $0.01$ and you get $6.01$. The numbers are closing in on $6$, which is exactly $2x$ at $x = 3$.\n\n**Remember:** the formula is just “slope between two points” with the points squeezed together. *(Demo response. Add an API key for real explanations.)*`;
  return drip(res, text, 24, 18);
}
