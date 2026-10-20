// Derived progress numbers for courses and units.

import { store } from "./store.js";
import { countTopics, listTopics, getTopic } from "../data/courses.js";

export function courseProgress(course) {
  const topics = store.getCourse(course.id)?.topics || {};
  const done = Object.values(topics).filter((t) => t.done).length;
  const total = countTopics(course);
  return { done, total, pct: total ? done / total : 0 };
}

export function unitProgress(course, unitIndex) {
  const topics = store.getCourse(course.id)?.topics || {};
  const list = listTopics(course).filter((t) => t.unitIndex === unitIndex);
  const done = list.filter((t) => topics[t.id]?.done).length;
  return { done, total: list.length, pct: list.length ? done / list.length : 0 };
}

export function topicStatus(course, topicId) {
  const t = store.getCourse(course.id)?.topics?.[topicId];
  if (t?.done) return "done";
  if (t?.opened) return "started";
  return "new";
}

// The next topic to study: first unfinished topic after the last one opened,
// falling back to the first unfinished topic in the course.
export function nextTopic(course) {
  const all = listTopics(course);
  const state = store.getCourse(course.id)?.topics || {};
  const last = store.lastVisited();
  if (last?.courseId === course.id && getTopic(course, last.topicId) && !state[last.topicId]?.done) {
    return getTopic(course, last.topicId);
  }
  return all.find((t) => !state[t.id]?.done) || all[0];
}
