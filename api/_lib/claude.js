import Anthropic from "@anthropic-ai/sdk";

// Model and effort are configurable per route through environment variables.
export const LESSON_MODEL = process.env.LESSON_MODEL || "claude-opus-5";
export const EXPLAIN_MODEL = process.env.EXPLAIN_MODEL || "claude-opus-5";
export const LESSON_EFFORT = process.env.LESSON_EFFORT || "medium";
export const EXPLAIN_EFFORT = process.env.EXPLAIN_EFFORT || "low";

let client;
export function getClient() {
  client ??= new Anthropic();
  return client;
}

export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const isMock = () => process.env.MOCK_AI === "1";

// Streams a Claude response to the browser as newline-delimited JSON:
//   {"t":"delta","d":"..."}   text as it's written
//   {"t":"done","text":"..."} full text once finished
//   {"t":"error","message":"..."}
// Refusals are served by a fallback model (fallbacks: "default").
export async function streamToResponse(res, params) {
  startNdjson(res);
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const stream = getClient().beta.messages.stream(
      {
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: abort.signal }
    );
    stream.on("text", (d) => send(res, { t: "delta", d }));
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      send(res, { t: "error", message: "The tutor couldn't write this one. Try again or pick another topic." });
    } else if (message.stop_reason === "max_tokens") {
      send(res, { t: "error", message: "The lesson ran too long and was cut off. Try the 'Shorter' option." });
    } else {
      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      send(res, { t: "done", text });
    }
  } catch (err) {
    if (abort.signal.aborted) return;
    send(res, { t: "error", message: describeError(err) });
  }
  res.end();
}

export function startNdjson(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
}

export function send(res, obj) {
  res.write(JSON.stringify(obj) + "\n");
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The server's Anthropic API key is invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Lots of students studying right now. Wait a moment and try again.";
  if (err instanceof Anthropic.BadRequestError) {
    console.error("Claude bad request:", err.message);
    return "The lesson request was rejected. Please try again.";
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`Claude API error ${err.status}:`, err.message);
    return "The AI service had a hiccup. Please try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check the connection and try again.";
  console.error(err);
  return "Something went wrong generating this. Please try again.";
}

export function sendJsonError(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: message }));
}

// Vercel parses JSON bodies for us; the local dev server does too. This
// also accepts a raw string just in case.
export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}
