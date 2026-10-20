import { COURSES, CATEGORIES, countTopics, getCourse, getTopic } from "../../data/courses.js";
import { store } from "../store.js";
import { esc } from "../render.js";
import { $, $$, reveal, countUp, ring } from "../ui.js";
import { courseProgress } from "../progress.js";
import { STYLE_OPTIONS, withDefaults, labelOf } from "../learning.js";

const FLOATERS = ["∫", "Σ", "π", "Δ", "λ", "√", "∞", "θ", "μ", "⚛", "🧬", "📜", "∂", "≈"];

let filter = { q: "", cat: "all" };

export function renderHome(el) {
  const totalUnits = COURSES.reduce((s, c) => s + c.units.length, 0);
  const totalTopics = COURSES.reduce((s, c) => s + countTopics(c), 0);
  const last = store.lastVisited();
  const lastCourse = last && getCourse(last.courseId);
  const lastTopic = lastCourse && getTopic(lastCourse, last.topicId);
  const inProgress = COURSES.filter((c) => store.getCourse(c.id)?.knowledge);
  const profile = store.getProfile();

  el.innerHTML = `
    <section class="hero">
      <div class="hero-floaters" aria-hidden="true">
        ${FLOATERS.map((f, i) => `<span style="--i:${i};--x:${(i * 73) % 100}%;--y:${(i * 37) % 100}%">${f}</span>`).join("")}
      </div>
      <div class="container hero-inner">
        <p class="eyebrow stagger" style="--i:0">Every AP course · every unit · every topic</p>
        <h1 class="hero-title stagger" style="--i:1">Study for your APs with lessons <span class="hl">written for how you learn.</span></h1>
        <p class="hero-sub stagger" style="--i:2">Pick a course, tell us what you already know, and get clear, AI-written lessons for each College Board topic, with formulas explained line by line.</p>
        <div class="hero-cta stagger" style="--i:3">
          ${
            lastTopic
              ? `<a class="btn btn-primary btn-lg" href="#/learn/${lastCourse.id}/${lastTopic.id}">Continue ${esc(lastCourse.short)} · ${esc(lastTopic.id)} <span aria-hidden="true">→</span></a>
                 <button type="button" class="btn btn-ghost btn-lg" data-scroll>Browse courses</button>`
              : `<button type="button" class="btn btn-primary btn-lg" data-scroll>Pick a course <span aria-hidden="true">→</span></button>
                 <a class="btn btn-ghost btn-lg" href="#/style">Set my learning style</a>`
          }
        </div>
        <dl class="hero-stats stagger" style="--i:4">
          <div><dt>Courses</dt><dd data-count="${COURSES.length}">0</dd></div>
          <div><dt>Units</dt><dd data-count="${totalUnits}">0</dd></div>
          <div><dt>Topics</dt><dd data-count="${totalTopics}">0</dd></div>
        </dl>
      </div>
    </section>

    ${
      inProgress.length
        ? `<section class="container section">
        <div class="section-head reveal"><h2>Your courses</h2></div>
        <div class="mini-grid">
          ${inProgress
            .map((c, i) => {
              const p = courseProgress(c);
              return `<a class="mini-card reveal" href="#/course/${c.id}" style="--c:${c.color};--i:${i}">
                ${ring(p.pct, { size: 48 })}
                <span><strong>${esc(c.name)}</strong><span class="muted small">${p.done} of ${p.total} topics</span></span>
              </a>`;
            })
            .join("")}
        </div>
      </section>`
        : ""
    }

    <section class="container section" id="courses">
      <div class="section-head reveal">
        <h2>All courses</h2>
        <div class="search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input type="search" class="input" placeholder="Search courses or topics…" aria-label="Search courses or topics" value="${esc(filter.q)}" />
        </div>
      </div>
      <div class="cat-tabs reveal" role="tablist" aria-label="Filter by subject">
        <button role="tab" data-cat="all" aria-selected="${filter.cat === "all"}">All</button>
        ${CATEGORIES.map((c) => `<button role="tab" data-cat="${c.id}" aria-selected="${filter.cat === c.id}" style="--c:${c.color}">${esc(c.name)}</button>`).join("")}
      </div>
      <div class="course-groups"></div>
    </section>

    <section class="container section how">
      <div class="section-head reveal"><h2>Lessons that adapt to you</h2></div>
      <div class="how-grid">
        ${[
          ["🎯", "Starts where you are", "The first time you open a course, you tell us how much you already know. Lessons skip what you've got and slow down where you don't."],
          ["🎨", "Your style, every lesson", `Step-by-step, examples-first, visual, analogies, or big picture. ${profile ? `Right now you're on <strong>${esc(labelOf(STYLE_OPTIONS, withDefaults(profile).style))}</strong>.` : "Set it once and every lesson follows it."}`],
          ["🔁", "One-tap rewrites", "Too dense? Tap <em>Simpler</em>, <em>More examples</em>, or <em>Explain differently</em> and get a fresh version in seconds. Like it? Make it your default."],
          ["📐", "Formulas, decoded", "Every formula is typeset properly and followed by a plain-English explanation. Still fuzzy? Tap <em>Explain further</em> for a quick deeper dive."],
        ]
          .map(
            ([icon, title, body], i) => `<article class="how-card reveal" style="--i:${i}">
              <span class="how-icon">${icon}</span><h3>${title}</h3><p>${body}</p></article>`
          )
          .join("")}
      </div>
      <div class="how-cta reveal"><a class="btn btn-ghost" href="#/style">Tune my learning style →</a></div>
    </section>`;

  $$("[data-count]", el).forEach((n) => countUp(n, Number(n.dataset.count)));

  const groups = $(".course-groups", el);
  const input = $(".search input", el);
  const draw = () => {
    groups.innerHTML = renderGroups();
    reveal(groups);
  };
  input.addEventListener("input", () => {
    filter.q = input.value;
    draw();
  });
  $$(".cat-tabs button", el).forEach((b) =>
    b.addEventListener("click", () => {
      filter.cat = b.dataset.cat;
      $$(".cat-tabs button", el).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      draw();
    })
  );
  // Card tilt that follows the pointer.
  groups.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".course-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    card.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
    card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
  });
  groups.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".course-card");
    if (card && !card.contains(e.relatedTarget)) {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }
  });

  draw();
  reveal(el);
  $$("[data-scroll]", el).forEach((b) =>
    b.addEventListener("click", () => $("#courses", el).scrollIntoView({ behavior: "smooth" }))
  );
}

function matches(course, q) {
  if (!q) return { ok: true, hits: [] };
  const needle = q.toLowerCase();
  if ((course.name + " " + course.short).toLowerCase().includes(needle)) return { ok: true, hits: [] };
  const hits = [];
  course.units.forEach((u, ui) =>
    u.topics.forEach((t, ti) => {
      if (t.toLowerCase().includes(needle)) hits.push({ id: `${(course.unitStart || 1) + ui}.${ti + 1}`, title: t });
    })
  );
  return { ok: hits.length > 0, hits };
}

function renderGroups() {
  const q = filter.q.trim();
  let i = 0;
  const html = CATEGORIES.filter((cat) => filter.cat === "all" || filter.cat === cat.id)
    .map((cat) => {
      const cards = COURSES.filter((c) => c.category === cat.id)
        .map((c) => ({ c, m: matches(c, q) }))
        .filter((x) => x.m.ok)
        .map(({ c, m }) => {
          const p = courseProgress(c);
          return `<a class="course-card reveal" href="#/course/${c.id}" style="--c:${c.color};--i:${i++ % 8}">
            <span class="card-glow" aria-hidden="true"></span>
            <span class="course-top">
              <span class="course-icon">${esc(c.icon)}</span>
              ${p.done ? ring(p.pct, { size: 40, stroke: 4 }) : ""}
            </span>
            <strong class="course-name">${esc(c.name)}</strong>
            <span class="course-blurb">${esc(c.blurb)}</span>
            ${
              m.hits.length
                ? `<span class="topic-hits">${m.hits
                    .slice(0, 3)
                    .map((h) => `<span>${esc(h.id)} ${esc(h.title)}</span>`)
                    .join("")}${m.hits.length > 3 ? `<span class="muted">+${m.hits.length - 3} more</span>` : ""}</span>`
                : ""
            }
            <span class="course-meta">${c.units.length} ${c.unitLabel ? c.unitLabel.toLowerCase() + "s" : "units"} · ${countTopics(c)} topics</span>
          </a>`;
        });
      if (!cards.length) return "";
      return `<div class="course-group">
        <h3 class="group-title reveal" style="--c:${cat.color}"><span class="dot"></span>${esc(cat.name)}</h3>
        <div class="course-grid">${cards.join("")}</div>
      </div>`;
    })
    .join("");
  return html || `<p class="empty-state muted">No courses or topics match “${esc(q)}”.</p>`;
}
