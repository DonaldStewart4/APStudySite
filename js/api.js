// Client for the /api routes. Both stream newline-delimited JSON:
// {"t":"delta","d":"..."} ... then {"t":"done","text":"..."} or {"t":"error","message":"..."}

export class ApiError extends Error {}

async function streamNdjson(path, body, { onDelta, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    let message = `The server returned an error (${res.status}).`;
    try {
      message = (await res.json()).error || message;
    } catch {}
    throw new ApiError(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.t === "delta") onDelta?.(msg.d);
      else if (msg.t === "done") {
        reader.cancel().catch(() => {});
        return msg.text;
      }
      else if (msg.t === "error") throw new ApiError(msg.message);
    }
  }
  throw new ApiError("The connection closed before the tutor finished. Please try again.");
}

export async function generateLesson(payload, opts) {
  const text = await streamNdjson("/api/lesson", payload, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("The lesson came back garbled. Please try again.");
  }
}

export function explainFurther(payload, opts) {
  return streamNdjson("/api/explain", payload, opts);
}
