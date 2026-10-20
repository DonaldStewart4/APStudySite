// Sanity checks for the course catalog: unique ids, non-empty units, and no
// duplicate topics inside a unit. Run with `npm run check`.

import { COURSES, CATEGORIES, listTopics, countTopics } from "../data/courses.js";

let problems = 0;
const fail = (msg) => {
  problems++;
  console.error("✗", msg);
};

const ids = new Set();
const cats = new Set(CATEGORIES.map((c) => c.id));
for (const c of COURSES) {
  if (ids.has(c.id)) fail(`duplicate course id ${c.id}`);
  ids.add(c.id);
  if (!cats.has(c.category)) fail(`${c.id}: unknown category ${c.category}`);
  if (!c.units.length) fail(`${c.id}: no units`);
  c.units.forEach((u, i) => {
    if (!u.topics.length) fail(`${c.id} unit ${i + 1}: no topics`);
    if (new Set(u.topics).size !== u.topics.length) fail(`${c.id} unit ${i + 1}: duplicate topic`);
  });
  const topicIds = listTopics(c).map((t) => t.id);
  if (new Set(topicIds).size !== topicIds.length) fail(`${c.id}: duplicate topic ids`);
}

const topics = COURSES.reduce((s, c) => s + countTopics(c), 0);
const units = COURSES.reduce((s, c) => s + c.units.length, 0);
console.log(`${COURSES.length} courses, ${units} units, ${topics} topics`);
if (problems) process.exit(1);
console.log("✓ catalog looks good");
