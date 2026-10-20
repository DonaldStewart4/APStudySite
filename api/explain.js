// POST /api/explain
// Body: { courseId, topicId, latex, name, explanation, profile }
// Streams a short "explain further" note for one formula as NDJSON.

import { getCourse, getTopic } from "../data/courses.js";
import { sanitizeProfile } from "./_lib/profile.js";
import { EXPLAIN_SYSTEM, explainUserPrompt } from "./_lib/prompts.js";
import {
  EXPLAIN_MODEL,
  EXPLAIN_EFFORT,
  hasCredentials,
  isMock,
  readBody,
  sendJsonError,
  streamToResponse,
} from "./_lib/claude.js";
import { streamMockExplain } from "./_lib/mock.js";

const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJsonError(res, 405, "Use POST.");

  const body = readBody(req);
  const course = body && getCourse(body.courseId);
  const topic = course && getTopic(course, body.topicId);
  const latex = clip(body?.latex, 1500);
  if (!topic || !latex) return sendJsonError(res, 400, "Missing formula or topic.");

  if (isMock()) return streamMockExplain(res, latex);
  if (!hasCredentials()) {
    return sendJsonError(res, 503, "The AI tutor isn't configured yet. Set ANTHROPIC_API_KEY on the server.");
  }

  await streamToResponse(res, {
    model: EXPLAIN_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: EXPLAIN_EFFORT },
    system: EXPLAIN_SYSTEM,
    messages: [
      {
        role: "user",
        content: explainUserPrompt({
          course,
          topic,
          latex,
          name: clip(body.name, 120),
          explanation: clip(body.explanation, 2000),
          profile: sanitizeProfile(body.profile),
        }),
      },
    ],
  });
}
