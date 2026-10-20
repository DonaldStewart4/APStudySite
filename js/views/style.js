import { COURSES } from "../../data/courses.js";
import { store } from "../store.js";
import { esc } from "../render.js";
import { $, $$, reveal, toast, confetti } from "../ui.js";
import {
  STYLE_OPTIONS,
  DEPTH_OPTIONS,
  READING_OPTIONS,
  EXTRA_OPTIONS,
  KNOWLEDGE_OPTIONS,
  STYLE_QUIZ,
  withDefaults,
  labelOf,
} from "../learning.js";
import { runOnboarding } from "../components/onboarding.js";

export function renderStyle(el) {
  document.title = "My learning style · Road to 5";
  let p = withDefaults(store.getProfile());

  const save = (patch, quiet = false) => {
    p = { ...p, ...patch };
    store.saveProfile(p);
    if (!quiet) flashSaved();
  };

  let savedTimer;
  const flashSaved = () => {
    const s = $(".saved-pill", el);
    s.classList.add("show");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => s.classList.remove("show"), 1600);
  };

  el.innerHTML = `
    <section class="container narrow section style-page">
      <a class="crumb stagger" style="--i:0" href="#/">← Courses</a>
      <h1 class="stagger" style="--i:1">My learning style</h1>
      <p class="lede stagger" style="--i:2">Every lesson is written from scratch using these settings. Change anything and your next lesson follows it.</p>
      <span class="saved-pill" role="status">✓ Saved</span>

      <div class="panel reveal">
        <div class="panel-head">
          <h2>How do you like things explained?</h2>
          <button type="button" class="link-btn" data-quiz>Not sure? Take the 3-question quiz</button>
        </div>
        <div class="quiz-slot"></div>
        <div class="choice-grid five" role="radiogroup" aria-label="Learning style">
          ${STYLE_OPTIONS.map(
            (o, i) => `
            <button type="button" role="radio" class="choice-card ${p.style === o.id ? "selected" : ""}" aria-checked="${p.style === o.id}" data-style="${o.id}" style="--i:${i}">
              <span class="choice-icon">${o.icon}</span><strong>${esc(o.label)}</strong><span class="muted small">${esc(o.desc)}</span>
            </button>`
          ).join("")}
        </div>
      </div>

      <div class="panel reveal">
        <h2>Lesson length</h2>
        <div class="segmented" role="radiogroup" aria-label="Lesson length">
          ${DEPTH_OPTIONS.map((o) => `<button type="button" role="radio" aria-checked="${p.depth === o.id}" data-depth="${o.id}">${esc(o.label)}<small>${esc(o.desc)}</small></button>`).join("")}
        </div>
        <h2>Reading level</h2>
        <div class="segmented" role="radiogroup" aria-label="Reading level">
          ${READING_OPTIONS.map((o) => `<button type="button" role="radio" aria-checked="${p.reading === o.id}" data-reading="${o.id}">${esc(o.label)}<small>${esc(o.desc)}</small></button>`).join("")}
        </div>
        <h2>Worked examples per lesson <output class="examples-out">${p.examples}</output></h2>
        <input type="range" class="range" min="1" max="4" step="1" value="${p.examples}" aria-label="Worked examples per lesson" />
      </div>

      <div class="panel reveal">
        <h2>Include in every lesson</h2>
        <div class="toggles">
          ${EXTRA_OPTIONS.map(
            (o) => `<label class="toggle"><input type="checkbox" data-extra="${o.id}" ${p.extras[o.id] ? "checked" : ""} /><span class="switch"></span>${esc(o.label)}</label>`
          ).join("")}
        </div>
      </div>

      <div class="panel reveal">
        <h2>Make it personal</h2>
        <label class="field-label" for="interests">Your interests <span class="muted">(used for examples and analogies)</span></label>
        <input id="interests" class="input" maxlength="200" placeholder="e.g. basketball, Minecraft, cooking, music production" value="${esc(p.interests)}" />
        <label class="field-label" for="notes">Anything else your tutor should know?</label>
        <textarea id="notes" class="input" rows="3" maxlength="500" placeholder="e.g. I have ADHD, so keep paragraphs short. I learn best when I see the mistake first.">${esc(p.notes)}</textarea>
        <p class="muted small">Tip: while reading any lesson, tap <strong>Simpler</strong>, <strong>More examples</strong>, or other rewrite buttons. If you like the result, you can make it your default with one tap.</p>
      </div>

      <div class="panel reveal">
        <h2>What you've told us per course</h2>
        <div class="course-levels"></div>
      </div>
    </section>`;

  // Style cards
  const pickStyle = (id) => {
    $$("[data-style]", el).forEach((b) => {
      const on = b.dataset.style === id;
      b.classList.toggle("selected", on);
      b.setAttribute("aria-checked", String(on));
    });
    save({ style: id });
  };
  $$("[data-style]", el).forEach((b) => b.addEventListener("click", () => pickStyle(b.dataset.style)));

  // Segmented controls
  for (const key of ["depth", "reading"]) {
    $$(`[data-${key}]`, el).forEach((b) =>
      b.addEventListener("click", () => {
        $$(`[data-${key}]`, el).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        save({ [key]: b.dataset[key] });
      })
    );
  }

  const range = $(".range", el);
  range.addEventListener("input", () => ($(".examples-out", el).textContent = range.value));
  range.addEventListener("change", () => save({ examples: Number(range.value) }));

  $$("[data-extra]", el).forEach((c) =>
    c.addEventListener("change", () => save({ extras: { ...p.extras, [c.dataset.extra]: c.checked } }))
  );

  for (const id of ["interests", "notes"]) {
    const input = $(`#${id}`, el);
    let t;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => save({ [id]: input.value.trim() }), 600);
    });
  }

  // Style quiz
  $("[data-quiz]", el).addEventListener("click", (e) => {
    e.currentTarget.hidden = true;
    runQuiz($(".quiz-slot", el), (style) => {
      pickStyle(style);
      const card = $(`[data-style="${style}"]`, el);
      const r = card.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2);
      toast(`You're a “${labelOf(STYLE_OPTIONS, style)}” learner. Saved!`, { type: "good" });
    });
  });

  // Per-course knowledge
  const drawLevels = () => {
    const started = COURSES.filter((c) => store.getCourse(c.id)?.knowledge);
    $(".course-levels", el).innerHTML = started.length
      ? started
          .map(
            (c) => `<div class="level-row" style="--c:${c.color}">
              <span class="course-icon xs">${esc(c.icon)}</span>
              <span class="level-name">${esc(c.name)}</span>
              <span class="adapt-chip">${esc(labelOf(KNOWLEDGE_OPTIONS, store.getCourse(c.id).knowledge))}</span>
              <button type="button" class="link-btn" data-edit="${c.id}">Edit</button>
            </div>`
          )
          .join("")
      : `<p class="muted">You haven't started a course yet. When you open one, we'll ask how much you already know.</p>`;
    $$("[data-edit]", el).forEach((b) =>
      b.addEventListener("click", async () => {
        const course = COURSES.find((c) => c.id === b.dataset.edit);
        if (await runOnboarding(course, { editing: true })) drawLevels();
      })
    );
  };
  drawLevels();
  reveal(el);
}

function runQuiz(slot, onDone) {
  const votes = {};
  let i = 0;
  const draw = () => {
    const q = STYLE_QUIZ[i];
    slot.innerHTML = `
      <div class="style-quiz">
        <p class="muted small">Question ${i + 1} of ${STYLE_QUIZ.length}</p>
        <p class="sq-q">${esc(q.q)}</p>
        <div class="sq-answers">
          ${q.a.map((a, ai) => `<button type="button" class="sq-a" data-a="${ai}" style="--i:${ai}">${esc(a.text)}</button>`).join("")}
        </div>
      </div>`;
    $$(".sq-a", slot).forEach((b) =>
      b.addEventListener("click", () => {
        const vote = q.a[Number(b.dataset.a)].vote;
        votes[vote] = (votes[vote] || 0) + 1;
        b.classList.add("picked");
        setTimeout(() => {
          i++;
          if (i < STYLE_QUIZ.length) draw();
          else {
            const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
            slot.innerHTML = "";
            onDone(best);
          }
        }, 280);
      })
    );
  };
  draw();
}
