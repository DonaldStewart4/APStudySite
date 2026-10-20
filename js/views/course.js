import { getCourse, listTopics, unitLabel, unitNumber, countTopics } from "../../data/courses.js";
import { store } from "../store.js";
import { esc } from "../render.js";
import { $, $$, reveal, ring } from "../ui.js";
import { courseProgress, unitProgress, topicStatus, nextTopic } from "../progress.js";
import { needsOnboarding, runOnboarding } from "../components/onboarding.js";
import { KNOWLEDGE_OPTIONS, labelOf } from "../learning.js";

export function renderCourse(el, courseId) {
  const course = getCourse(courseId);
  if (!course) {
    el.innerHTML = `<section class="container empty-state"><h1>Course not found</h1><a class="btn" href="#/">All courses</a></section>`;
    return;
  }
  document.title = `${course.name} · Road to 5`;

  const draw = () => {
    const state = store.getCourse(course.id) || {};
    const p = courseProgress(course);
    const next = nextTopic(course);
    const openUnit = next?.unitIndex ?? 0;

    el.innerHTML = `
      <section class="course-hero" style="--c:${course.color}">
        <div class="container">
          <a class="crumb stagger" style="--i:0" href="#/">← All courses</a>
          <div class="course-hero-row">
            <div class="course-hero-text">
              <span class="course-icon lg stagger" style="--i:1">${esc(course.icon)}</span>
              <h1 class="stagger" style="--i:2">${esc(course.name)}</h1>
              <p class="lede stagger" style="--i:3">${esc(course.blurb)}</p>
              <div class="hero-cta stagger" style="--i:4">
                <a class="btn btn-primary btn-lg" href="#/learn/${course.id}/${next.id}">
                  ${p.done ? "Continue" : "Start"} with ${esc(next.id)} <span aria-hidden="true">→</span></a>
                ${
                  state.knowledge
                    ? `<button type="button" class="pill-btn" data-edit-knowledge title="Change what you told us">
                        Level: <strong>${esc(labelOf(KNOWLEDGE_OPTIONS, state.knowledge))}</strong> · edit</button>`
                    : ""
                }
              </div>
            </div>
            <div class="course-hero-stat stagger" style="--i:3">
              ${ring(p.pct, { size: 120, stroke: 9 })}
              <p class="muted small">${p.done} of ${p.total} topics done</p>
            </div>
          </div>
        </div>
      </section>

      <section class="container section">
        <div class="unit-list">
          ${course.units
            .map((u, ui) => {
              const up = unitProgress(course, ui);
              const n = unitNumber(course, ui);
              const strong = (state.strongUnits || []).includes(ui);
              return `
              <article class="unit-card reveal ${ui === openUnit ? "open" : ""}" style="--c:${course.color};--i:${ui % 6}">
                <button class="unit-head" type="button" aria-expanded="${ui === openUnit}">
                  <span class="unit-num">${esc(unitLabel(course))} ${n}</span>
                  <span class="unit-title">${esc(u.title)}${strong ? ` <span class="tag">You're confident here</span>` : ""}</span>
                  <span class="unit-meta">
                    <span class="weight" title="Share of the AP exam">${esc(u.weight)}</span>
                    <span class="bar" aria-label="${up.done} of ${up.total} topics done"><span style="--p:${up.pct}"></span></span>
                    <span class="chev" aria-hidden="true"></span>
                  </span>
                </button>
                <div class="unit-body"><div>
                  <ol class="topic-list">
                    ${listTopics(course)
                      .filter((t) => t.unitIndex === ui)
                      .map((t, ti) => {
                        const s = topicStatus(course, t.id);
                        return `<li style="--n:${ti}"><a class="topic-row status-${s}" href="#/learn/${course.id}/${t.id}">
                          <span class="topic-dot" aria-hidden="true"></span>
                          <span class="topic-id">${esc(t.id)}</span>
                          <span class="topic-title">${esc(t.title)}</span>
                          <span class="topic-state">${s === "done" ? "Done" : s === "started" ? "In progress" : ""}</span>
                        </a></li>`;
                      })
                      .join("")}
                  </ol>
                </div></div>
              </article>`;
            })
            .join("")}
        </div>
        <p class="muted small center">${course.units.length} ${esc(unitLabel(course).toLowerCase())}s · ${countTopics(course)} topics · exam weights from the College Board CED</p>
      </section>`;

    $$(".unit-head", el).forEach((b) =>
      b.addEventListener("click", () => {
        const card = b.closest(".unit-card");
        const open = !card.classList.contains("open");
        card.classList.toggle("open", open);
        b.setAttribute("aria-expanded", String(open));
      })
    );
    $("[data-edit-knowledge]", el)?.addEventListener("click", async () => {
      if (await runOnboarding(course, { editing: true })) draw();
    });
    reveal(el);
  };

  draw();
  // Not awaited: the router's view transition shouldn't wait on the student.
  if (needsOnboarding(course)) runOnboarding(course).then(draw);
}
