// All saved student data goes through this module.
//
// Reads are synchronous from localStorage so views render instantly.
// Writes go to localStorage and, when a Supabase user is signed in, are also
// pushed to the database (fire-and-forget). On sign-in, remote data is pulled
// and merged by "updatedAt", so a student's progress follows them across
// devices. Swapping the backend only means changing `remote` below.

import { auth } from "./auth.js";

const NS = "r5:";
const LESSON_CACHE_LIMIT = 40;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode or storage full: the app still works for this visit
  }
}

function remove(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch {}
}

// ---------- Remote (Supabase) ----------
// Tables are defined in supabase/schema.sql. Each row stores a JSON blob.

const remote = {
  async push(kind, courseId, data) {
    const db = auth.client();
    if (!db || !auth.user) return;
    const row = { user_id: auth.user.id, data, updated_at: new Date(data.updatedAt || Date.now()).toISOString() };
    const { error } =
      kind === "profile"
        ? await db.from("learning_profiles").upsert(row)
        : await db.from("course_progress").upsert({ ...row, course_id: courseId });
    if (error) console.warn("Sync failed:", error.message);
  },

  async pullAll() {
    const db = auth.client();
    if (!db || !auth.user) return null;
    const [p, c] = await Promise.all([
      db.from("learning_profiles").select("data").maybeSingle(),
      db.from("course_progress").select("course_id, data"),
    ]);
    if (p.error || c.error) {
      console.warn("Sync pull failed:", (p.error || c.error).message);
      return null;
    }
    return { profile: p.data?.data ?? null, courses: c.data ?? [] };
  },
};

const newer = (a, b) => (a?.updatedAt || 0) >= (b?.updatedAt || 0);

// ---------- Public API ----------

export const store = {
  // Global learning profile (style, depth, reading level, ...). null until set.
  getProfile() {
    return read("profile", null);
  },
  saveProfile(profile) {
    const data = { ...profile, updatedAt: Date.now() };
    write("profile", data);
    remote.push("profile", null, data);
    return data;
  },

  // Per-course record: knowledge check answers, difficulty feedback, topic progress.
  getCourse(courseId) {
    return read(`course:${courseId}`, null);
  },
  saveCourse(courseId, patch) {
    const current = this.getCourse(courseId) || { topics: {} };
    const data = { ...current, ...patch, updatedAt: Date.now() };
    write(`course:${courseId}`, data);
    remote.push("course", courseId, data);
    return data;
  },
  setTopic(courseId, topicId, patch) {
    const current = this.getCourse(courseId) || { topics: {} };
    const topics = { ...current.topics, [topicId]: { ...current.topics?.[topicId], ...patch } };
    return this.saveCourse(courseId, { topics });
  },
  resetCourse(courseId) {
    remove(`course:${courseId}`);
    remote.push("course", courseId, { topics: {}, reset: true, updatedAt: Date.now() });
  },
  lastVisited() {
    return read("last", null);
  },
  setLastVisited(courseId, topicId) {
    write("last", { courseId, topicId, at: Date.now() });
  },

  // Generated lessons are cached locally (not synced) so revisiting is instant.
  getLesson(key) {
    const index = read("lesson-index", []);
    if (!index.includes(key)) return null;
    write("lesson-index", [key, ...index.filter((k) => k !== key)]);
    return read(`lesson:${key}`, null);
  },
  cacheLesson(key, lesson) {
    let index = read("lesson-index", []).filter((k) => k !== key);
    index.unshift(key);
    while (index.length > LESSON_CACHE_LIMIT) remove(`lesson:${index.pop()}`);
    // If storage is full, evict the oldest lessons until it fits.
    while (!write(`lesson:${key}`, lesson) && index.length > 1) remove(`lesson:${index.pop()}`);
    write("lesson-index", index);
  },
  forgetLesson(key) {
    remove(`lesson:${key}`);
    write("lesson-index", read("lesson-index", []).filter((k) => k !== key));
  },

  // Called after sign-in: merge remote data into local, then push anything
  // that only existed locally so nothing is lost.
  async syncFromRemote() {
    const pulled = await remote.pullAll();
    if (!pulled) return;
    const localProfile = this.getProfile();
    if (pulled.profile && !newer(localProfile, pulled.profile)) write("profile", pulled.profile);
    else if (localProfile) remote.push("profile", null, localProfile);

    const seen = new Set();
    for (const { course_id, data } of pulled.courses) {
      seen.add(course_id);
      const local = this.getCourse(course_id);
      if (!newer(local, data)) write(`course:${course_id}`, data);
      else remote.push("course", course_id, local);
    }
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(NS + "course:")) continue;
      const id = key.slice((NS + "course:").length);
      if (!seen.has(id)) remote.push("course", id, this.getCourse(id));
    }
  },
};
