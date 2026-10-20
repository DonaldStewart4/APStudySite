// First visit to a course: ask how much the student already knows (and, the
// very first time on the site, how they like to learn). Answers feed every
// lesson prompt for this course.

import { store } from "../store.js";
import { esc } from "../render.js";
import { openModal, $, $$ } from "../ui.js";
import { KNOWLEDGE_OPTIONS, STYLE_OPTIONS, DEPTH_OPTIONS, DEFAULT_PROFILE } from "../learning.js";
import { unitLabel, unitNumber } from "../../data/courses.js";

export function needsOnboarding(course) {
  return !store.getCourse(course.id)?.knowledge;
}

export function runOnboarding(course, { editing = false } = {}) {
  return new Promise((resolve) => {
    const existing = store.getCourse(course.id) || {};
    const askStyle = !store.getProfile();
    const answers = {
      knowledge: existing.knowledge || null,
      strongUnits: [...(existing.strongUnits || [])],
      struggles: existing.struggles || "",
      style: DEFAULT_PROFILE.style,
      depth: DEFAULT_PROFILE.depth,
    };
    const steps = ["knowledge", "units", ...(askStyle ? ["style"] : [])];
    let step = 0;

    const { el, close } = openModal({
      label: `Getting started with ${course.name}`,
      size: "lg",
      dismissable: editing,
      html: `
        <div class="onboard" style="--c:${esc(course.color)}">
          <div class="onboard-top">
            <span class="course-icon sm">${esc(course.icon)}</span>
            <div class="onboard-dots" aria-hidden="true">${steps.map(() => "<i></i>").join("")}</div>
          </div>
          <div class="onboard-stage"></div>
        </div>`,
      onClose: () => resolve(false),
    });
    const stage = $(".onboard-stage", el);

    const finish = () => {
      store.saveCourse(course.id, {
        knowledge: answers.knowledge || "some",
        strongUnits: answers.knowledge === "new" ? [] : answers.strongUnits,
        struggles: answers.struggles.trim(),
        difficultyShift: existing.difficultyShift || 0,
      });
      if (askStyle) store.saveProfile({ ...DEFAULT_PROFILE, style: answers.style, depth: answers.depth });
      resolve(true);
      close(true);
    };

    const views = {
      knowledge: () => `
        <h2>How much do you already know about ${esc(course.short || course.name)}?</h2>
        <p class="muted">Be honest! Your lessons start exactly where you are.</p>
        <div class="choice-grid">
          ${KNOWLEDGE_OPTIONS.map(
            (o, i) => `
            <button type="button" class="choice-card ${answers.knowledge === o.id ? "selected" : ""}" data-knowledge="${o.id}" style="--i:${i}">
              <span class="choice-icon">${o.icon}</span>
              <strong>${esc(o.label)}</strong>
              <span class="muted small">${esc(o.desc)}</span>
            </button>`
          ).join("")}
        </div>
        ${editing ? "" : `<div class="onboard-foot"><button type="button" class="link-btn" data-skip>Skip for now</button></div>`}`,

      units: () => `
        <h2>${answers.knowledge === "new" ? "Anything you're worried about?" : "Which units already feel solid?"}</h2>
        <p class="muted">${answers.knowledge === "new" ? "Optional. Tell the tutor what feels intimidating." : "Optional. Tap any you're confident in; lessons there will move faster."}</p>
        ${
          answers.knowledge === "new"
            ? ""
            : `<div class="chip-wrap">
          ${course.units
            .map(
              (u, i) => `<button type="button" class="chip ${answers.strongUnits.includes(i) ? "on" : ""}" data-unit="${i}" style="--i:${i}">
                <span class="chip-num">${esc(unitLabel(course))} ${unitNumber(course, i)}</span>${esc(u.title)}</button>`
            )
            .join("")}
        </div>`
        }
        <label class="field-label" for="ob-struggles">Anything you struggle with? <span class="muted">(optional)</span></label>
        <input id="ob-struggles" class="input" maxlength="300" placeholder="e.g. word problems, remembering dates, graphs…" value="${esc(answers.struggles)}" />
        <div class="onboard-foot">
          <button type="button" class="btn btn-ghost" data-back>Back</button>
          <button type="button" class="btn btn-primary" data-next>${steps.length > 2 ? "Next" : editing ? "Save" : "Start learning"}</button>
        </div>`,

      style: () => `
        <h2>Last thing: how do you like to learn?</h2>
        <p class="muted">Every lesson will be written this way. You can change it anytime in <em>My learning style</em>.</p>
        <div class="choice-grid five">
          ${STYLE_OPTIONS.map(
            (o, i) => `
            <button type="button" class="choice-card ${answers.style === o.id ? "selected" : ""}" data-style="${o.id}" style="--i:${i}">
              <span class="choice-icon">${o.icon}</span>
              <strong>${esc(o.label)}</strong>
              <span class="muted small">${esc(o.desc)}</span>
            </button>`
          ).join("")}
        </div>
        <p class="field-label">Lesson length</p>
        <div class="segmented" role="radiogroup" aria-label="Lesson length">
          ${DEPTH_OPTIONS.map(
            (o) => `<button type="button" role="radio" aria-checked="${answers.depth === o.id}" data-depth="${o.id}">${esc(o.label)}<small>${esc(o.desc)}</small></button>`
          ).join("")}
        </div>
        <div class="onboard-foot">
          <button type="button" class="btn btn-ghost" data-back>Back</button>
          <button type="button" class="btn btn-primary" data-next>Start learning</button>
        </div>`,
    };

    const show = (dir = 1) => {
      $$(".onboard-dots i", el).forEach((d, i) => d.classList.toggle("on", i <= step));
      const next = document.createElement("div");
      next.className = `onboard-step ${dir > 0 ? "from-right" : "from-left"}`;
      next.innerHTML = views[steps[step]]();
      stage.replaceChildren(next);
      bind(next);
    };

    const bind = (root) => {
      $$("[data-knowledge]", root).forEach((b) =>
        b.addEventListener("click", () => {
          answers.knowledge = b.dataset.knowledge;
          $$("[data-knowledge]", root).forEach((x) => x.classList.toggle("selected", x === b));
          setTimeout(() => {
            step++;
            show(1);
          }, 260);
        })
      );
      $("[data-skip]", root)?.addEventListener("click", () => {
        answers.knowledge = "some";
        finish();
      });
      $$("[data-unit]", root).forEach((b) =>
        b.addEventListener("click", () => {
          const i = Number(b.dataset.unit);
          const has = answers.strongUnits.includes(i);
          answers.strongUnits = has ? answers.strongUnits.filter((x) => x !== i) : [...answers.strongUnits, i];
          b.classList.toggle("on", !has);
        })
      );
      $("#ob-struggles", root)?.addEventListener("input", (e) => (answers.struggles = e.target.value));
      $$("[data-style]", root).forEach((b) =>
        b.addEventListener("click", () => {
          answers.style = b.dataset.style;
          $$("[data-style]", root).forEach((x) => x.classList.toggle("selected", x === b));
        })
      );
      $$("[data-depth]", root).forEach((b) =>
        b.addEventListener("click", () => {
          answers.depth = b.dataset.depth;
          $$("[data-depth]", root).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        })
      );
      $("[data-back]", root)?.addEventListener("click", () => {
        step--;
        show(-1);
      });
      $("[data-next]", root)?.addEventListener("click", () => {
        if (step === steps.length - 1) finish();
        else {
          step++;
          show(1);
        }
      });
    };

    show(1);
  });
}
