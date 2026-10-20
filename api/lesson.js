// POST /api/lesson
// Body: { courseId, topicId, profile, courseState, tweaks }
// Streams an AI-generated lesson as NDJSON (see _lib/claude.js).

import { getCourse, getTopic } from "../data/courses.js";
import { sanitizeProfile, sanitizeCourseState, sanitizeTweaks } from "./_lib/profile.js";
import { LESSON_SYSTEM, lessonUserPrompt } from "./_lib/prompts.js";
import { LESSON_SCHEMA } from "./_lib/schema.js";
import {
  LESSON_MODEL,
  LESSON_EFFORT,
  hasCredentials,
  isMock,
  readBody,
  sendJsonError,
  streamToResponse,
} from "./_lib/claude.js";
import { streamMockLesson } from "./_lib/mock.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJsonError(res, 405, "Use POST.");

  const body = readBody(req);
  const course = body && getCourse(body.courseId);
  const topic = course && getTopic(course, body.topicId);
  if (!topic) return sendJsonError(res, 400, "Unknown course or topic.");

  const profile = sanitizeProfile(body.profile);
  const courseState = sanitizeCourseState(body.courseState);
  const tweaks = sanitizeTweaks(body.tweaks);

  if (isMock()) return streamMockLesson(res, course, topic);
  if (!hasCredentials()) {
    return sendJsonError(res, 503, "The AI tutor isn't configured yet. Set ANTHROPIC_API_KEY on the server.");
  }

  const unitTopics = course.units[topic.unitIndex].topics;

  await streamToResponse(res, {
    model: LESSON_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: LESSON_EFFORT,
      format: { type: "json_schema", schema: LESSON_SCHEMA },
    },
    system: LESSON_SYSTEM,
    messages: [
      {
        role: "user",
        content: lessonUserPrompt({ course, topic, unitTopics, profile, courseState, tweaks }),
      },
    ],
  });
}
