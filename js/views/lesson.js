import { getCourse, getTopic, listTopics, unitLabel } from "../../data/courses.js";
import { store } from "../store.js";
import { esc, md, mdInline, tex, renderDiagrams } from "../render.js";
import { $, $$, reveal, toast, confetti, reducedMotion } from "../ui.js";
import { generateLesson, explainFurther, ApiError } from "../api.js";
import { topicStatus } from "../progress.js";
import { needsOnboarding, runOnboarding } from "../components/onboarding.js";
import {
  withDefaults,
  lessonFingerprint,
  labelOf,
  TWEAKS,
  STYLE_OPTIONS,
  DEPTH_OPTIONS,
  KNOWLEDGE_OPTIONS,
} from "../learning.js";

const WRITING_LINES = [
  "Reading the College Board topic…",
  "Matching it to what you already know…",
  "Choosing examples for your style…",
  "Typesetting the formulas…",
  "Writing practice questions…",
  "Double-checking the tricky parts…",
];

export function renderLesson(el, courseId, topicId) {
  const course = getCourse(courseId);
  const topic = course && getTopic(course, topicId);
  if (!topic) {
    el.innerHTML = `<section class="container empty-state"><h1>Topic not found</h1><a class="btn" href="#/">All courses</a></section>`;
    return;
  }
  document.title = `${topic.id} ${topic.title} · ${course.short} · Road to 5`;
  document.body.classList.add("is-lesson");

  const all = listTopics(course);
  const idx = all.findIndex((t) => t.id === topic.id);
  const prev = all[idx - 1];
  const next = all[idx + 1];
  let abort = null;
  let activeTweaks = [];

  el.innerHTML = `
    <div class="lesson-layout container" style="--c:${course.color}">
      <aside class="lesson-side">
        <a class="crumb" href="#/course/${course.id}">← ${esc(course.short)} overview</a>
        <details class="side-unit" open>
          <summary><span class="unit-num">${esc(unitLabel(course))} ${topic.unitNumber}</span> ${esc(topic.unitTitle)}</summary>
          <ol class="side-topics">
            ${all
              .filter((t) => t.unitIndex === topic.unitIndex)
              .map(
                (t) => `<li><a href="#/learn/${course.id}/${t.id}" class="status-${topicStatus(course, t.id)} ${t.id === topic.id ? "current" : ""}"
                  ${t.id === topic.id ? 'aria-current="page"' : ""}><span class="topic-dot"></span><span class="topic-id">${esc(t.id)}</span> ${esc(t.title)}</a></li>`
              )
              .join("")}
          </ol>
        </details>
      </aside>

      <article class="lesson-main">
        <header class="lesson-head">
          <p class="lesson-kicker stagger" style="--i:0">
            <span class="course-icon xs">${esc(course.icon)}</span> ${esc(course.name)} · ${esc(unitLabel(course))} ${topic.unitNumber}
          </p>
          <h1 class="stagger" style="--i:1"><span class="topic-pill">${esc(topic.id)}</span> ${esc(topic.title)}</h1>
          <div class="adapt-row stagger" style="--i:2"></div>
          <div class="tweak-bar stagger" style="--i:3" role="toolbar" aria-label="Rewrite this lesson">
            <span class="tweak-label">Rewrite it:</span>
            ${TWEAKS.map((t) => `<button type="button" class="tweak" data-tweak="${t.id}"><span aria-hidden="true">${t.icon}</span> ${esc(t.label)}</button>`).join("")}
            <button type="button" class="tweak ghost" data-regen title="Write a fresh version"><span aria-hidden="true">↻</span> New version</button>
          </div>
        </header>
        <div class="lesson-body" aria-live="polite"></div>
        <nav class="lesson-nav">
          ${prev ? `<a class="nav-card prev" href="#/learn/${course.id}/${prev.id}"><small>← Previous</small><span>${esc(prev.id)} ${esc(prev.title)}</span></a>` : "<span></span>"}
          ${next ? `<a class="nav-card next" href="#/learn/${course.id}/${next.id}"><small>Next →</small><span>${esc(next.id)} ${esc(next.title)}</span></a>` : `<a class="nav-card next" href="#/course/${course.id}"><small>Finished!</small><span>Back to ${esc(course.short)}</span></a>`}
        </nav>
      </article>
    </div>`;

  const body = $(".lesson-body", el);

  const drawAdaptRow = () => {
    const p = withDefaults(store.getProfile());
    const k = store.getCourse(course.id)?.knowledge;
    $(".adapt-row", el).innerHTML = `
      <span class="muted small">Written for you:</span>
      <a class="adapt-chip" href="#/style">${esc(labelOf(STYLE_OPTIONS, p.style))}</a>
      <a class="adapt-chip" href="#/style">${esc(labelOf(DEPTH_OPTIONS, p.depth))}</a>
      ${k ? `<a class="adapt-chip" href="#/course/${course.id}">${esc(labelOf(KNOWLEDGE_OPTIONS, k))}</a>` : ""}`;
  };

  // ---------- Loading & generation ----------

  const load = async ({ tweaks = [], fresh = false } = {}) => {
    abort?.abort();
    activeTweaks = tweaks;
    $$("[data-tweak]", el).forEach((b) => b.classList.toggle("on", tweaks.includes(b.dataset.tweak)));

    const profile = withDefaults(store.getProfile());
    const courseState = store.getCourse(course.id) || {};
    const key = `${course.id}:${topic.id}:${lessonFingerprint(profile, courseState, tweaks)}`;

    if (!fresh) {
      const cached = store.getLesson(key);
      if (cached) return showLesson(cached);
    } else {
      store.forgetLesson(key);
    }

    showWriting();
    abort = new AbortController();
    const signal = abort.signal;
    let received = "";
    const headings = [];
    try {
      const lesson = await generateLesson(
        { courseId: course.id, topicId: topic.id, profile, courseState, tweaks },
        {
          signal,
          onDelta: (d) => {
            received += d;
            updateWriting(received, headings);
          },
        }
      );
      if (signal.aborted) return;
      store.cacheLesson(key, lesson);
      showLesson(lesson);
      offerRemember(tweaks);
    } catch (err) {
      if (err.name === "AbortError" || signal.aborted) return;
      showError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  let lineTimer;
  const showWriting = () => {
    clearInterval(lineTimer);
    body.innerHTML = `
      <div class="writing">
        <div class="writing-orb" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="writing-text">
          <p class="writing-title">Your tutor is writing this lesson</p>
          <p class="writing-line muted">${WRITING_LINES[0]}</p>
          <ol class="writing-sections"></ol>
          <div class="writing-meter"><span></span></div>
        </div>
      </div>
      <div class="skeleton" aria-hidden="true">
        ${Array.from({ length: 9 }, (_, i) => `<span style="--w:${[92, 80, 97, 60, 88, 74, 95, 66, 40][i]}%;--i:${i}"></span>`).join("")}
      </div>`;
    let i = 0;
    lineTimer = setInterval(() => {
      const line = $(".writing-line", body);
      if (!line) return clearInterval(lineTimer);
      i = (i + 1) % WRITING_LINES.length;
      line.classList.remove("swap");
      void line.offsetWidth;
      line.textContent = WRITING_LINES[i];
      line.classList.add("swap");
    }, 2600);
  };

  const headingRe = /"heading"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const updateWriting = (text, headings) => {
    const list = $(".writing-sections", body);
    if (!list) return;
    const found = [...text.matchAll(headingRe)].map((m) => {
      try {
        return JSON.parse(`"${m[1]}"`);
      } catch {
        return m[1];
      }
    });
    if (found.length > headings.length) {
      for (const h of found.slice(headings.length)) {
        headings.push(h);
        $$("li", list).forEach((li) => li.classList.add("done"));
        const li = document.createElement("li");
        li.textContent = h;
        list.appendChild(li);
      }
    }
    if (text.includes('"practice"') && !list.querySelector(".practice-li")) {
      $$("li", list).forEach((li) => li.classList.add("done"));
      const li = document.createElement("li");
      li.className = "practice-li";
      li.textContent = "Practice questions";
      list.appendChild(li);
    }
    // Rough progress: lessons are usually 8k–20k characters of JSON.
    const pct = Math.min(0.96, text.length / 14000);
    $(".writing-meter span", body).style.transform = `scaleX(${pct})`;
  };

  const showError = (message) => {
    clearInterval(lineTimer);
    body.innerHTML = `
      <div class="error-card">
        <span class="error-icon" aria-hidden="true">😵‍💫</span>
        <h2>That lesson didn't come through</h2>
        <p class="muted">${esc(message)}</p>
        <button type="button" class="btn btn-primary" data-retry>Try again</button>
      </div>`;
    $("[data-retry]", body).addEventListener("click", () => load({ tweaks: activeTweaks }));
  };

  const offerRemember = (tweaks) => {
    const t = TWEAKS.find((x) => tweaks.includes(x.id) && x.remember);
    if (!t) return;
    toast(`Want every lesson like this (“${t.label}”)?`, {
      action: "Make it my default",
      timeout: 9000,
      onAction: () => {
        const p = withDefaults(store.getProfile());
        store.saveProfile({ ...p, ...t.remember(p) });
        drawAdaptRow();
        toast("Saved to your learning style.", { type: "good" });
      },
    });
  };

  // ---------- Lesson rendering ----------

  const showLesson = (lesson) => {
    clearInterval(lineTimer);
    body.innerHTML = `
      <div class="lesson-content">
        ${lesson.hook ? `<p class="lesson-hook reveal">${mdInline(lesson.hook)}</p>` : ""}
        ${
          lesson.objectives?.length
            ? `<div class="objectives reveal"><p class="obj-label">By the end, you'll be able to</p>
                <ul>${lesson.objectives.map((o) => `<li>${mdInline(o)}</li>`).join("")}</ul></div>`
            : ""
        }
        ${(lesson.sections || [])
          .map(
            (s, si) => `
          <section class="lesson-section">
            <h2 class="reveal"><span class="sec-num">${si + 1}</span>${esc(s.heading)}</h2>
            ${(s.blocks || []).map((b, bi) => renderBlock(b, `${si}-${bi}`)).join("")}
          </section>`
          )
          .join("")}
        ${
          lesson.keyTakeaways?.length
            ? `<section class="takeaways reveal"><h2>Key takeaways</h2>
                <ul>${lesson.keyTakeaways.map((k, i) => `<li style="--i:${i}">${mdInline(k)}</li>`).join("")}</ul></section>`
            : ""
        }
        ${lesson.practice?.length ? renderPractice(lesson.practice) : ""}
        <section class="feedback reveal">
          <h2>How did this lesson feel?</h2>
          <p class="muted">Your answer tunes the next lessons in ${esc(course.short)}.</p>
          <div class="feedback-btns">
            <button type="button" data-feel="-1"><span>😅</span>Too hard</button>
            <button type="button" data-feel="0"><span>👌</span>Just right</button>
            <button type="button" data-feel="1"><span>😴</span>Too easy</button>
          </div>
          <button type="button" class="btn btn-primary done-btn" data-done>${topicStatus(course, topic.id) === "done" ? "✓ Completed" : "Mark as done"}</button>
        </section>
      </div>`;
    bindLesson(lesson);
    reveal(body);
    renderDiagrams(body);
  };

  const bindLesson = (lesson) => {
    // Explain further
    $$(".explain-btn", body).forEach((btn) => btn.addEventListener("click", () => toggleExplain(btn)));

    // Worked example steps
    $$(".block-example", body).forEach((ex) => {
      const steps = $$(".step", ex);
      const nextBtn = $("[data-next-step]", ex);
      const allBtn = $("[data-all-steps]", ex);
      const answer = $(".example-answer", ex);
      let shown = 0;
      const update = () => {
        steps.forEach((s, i) => s.classList.toggle("shown", i < shown));
        const finished = shown >= steps.length;
        answer.classList.toggle("shown", finished);
        nextBtn.hidden = finished;
        allBtn.hidden = finished;
        nextBtn.textContent = shown === 0 ? "Show first step" : `Show step ${shown + 1} of ${steps.length}`;
      };
      nextBtn.addEventListener("click", () => {
        shown++;
        update();
      });
      allBtn.addEventListener("click", () => {
        shown = steps.length;
        update();
      });
      update();
    });

    // Check-yourself reveals
    $$(".block-check button", body).forEach((b) =>
      b.addEventListener("click", () => {
        const card = b.closest(".block-check");
        card.classList.add("revealed");
        b.remove();
      })
    );

    // Practice quiz
    const quiz = $(".practice", body);
    if (quiz) {
      let answered = 0;
      let correct = 0;
      $$(".q-card", quiz).forEach((card) => {
        const right = Number(card.dataset.correct);
        $$(".choice", card).forEach((c) =>
          c.addEventListener("click", (e) => {
            if (card.classList.contains("answered")) return;
            card.classList.add("answered");
            const pick = Number(c.dataset.i);
            const ok = pick === right;
            c.classList.add(ok ? "right" : "wrong");
            $$(".choice", card)[right]?.classList.add("right");
            $$(".choice", card).forEach((x) => (x.disabled = true));
            if (ok) {
              correct++;
              const r = c.getBoundingClientRect();
              confetti(r.left + r.width / 2, r.top + r.height / 2, 14);
            }
            answered++;
            const exp = $(".q-explain", card);
            exp.hidden = false;
            exp.classList.add("in");
            const total = lesson.practice.length;
            $(".score", quiz).innerHTML = `<strong>${correct}</strong> / ${total} correct`;
            if (answered === total) finishQuiz(correct, total);
          })
        );
      });
    }

    // Feedback
    $$("[data-feel]", body).forEach((b) =>
      b.addEventListener("click", () => {
        const feel = Number(b.dataset.feel);
        $$("[data-feel]", body).forEach((x) => x.classList.toggle("picked", x === b));
        const state = store.getCourse(course.id) || {};
        const shift = Math.max(-2, Math.min(2, (state.difficultyShift || 0) + feel));
        store.saveCourse(course.id, { difficultyShift: shift });
        if (feel === 0) return toast("Great, we'll keep it like this.", { type: "good" });
        toast(feel > 0 ? `Next ${course.short} lessons will be more challenging.` : `Next ${course.short} lessons will go slower and simpler.`, {
          action: feel > 0 ? "Rewrite this one harder" : "Rewrite this one simpler",
          onAction: () => {
            scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
            load({ tweaks: [feel > 0 ? "harder" : "simpler"] });
          },
          timeout: 8000,
        });
      })
    );

    $("[data-done]", body).addEventListener("click", (e) => markDone(e.currentTarget));
  };

  const markDone = (btn) => {
    store.setTopic(course.id, topic.id, { done: true, doneAt: Date.now() });
    const b = btn || $("[data-done]", body);
    if (b) {
      b.textContent = "✓ Completed";
      b.classList.add("pop");
      const r = b.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 30);
    }
    const link = $(`.side-topics a.current`, el);
    link?.classList.remove("status-new", "status-started");
    link?.classList.add("status-done");
  };

  const finishQuiz = (correct, total) => {
    const quiz = $(".practice", body);
    const pct = correct / total;
    store.setTopic(course.id, topic.id, { quiz: { correct, total, at: Date.now() } });
    const msg = pct === 1 ? "Perfect score! 🎉" : pct >= 0.6 ? "Nice work! 💪" : "Good effort. Review the explanations and try the next version.";
    const res = document.createElement("div");
    res.className = "quiz-result in";
    res.innerHTML = `<p>${msg}</p>${pct >= 0.6 ? "" : `<button type="button" class="btn btn-ghost btn-sm" data-simpler>Rewrite this lesson simpler</button>`}`;
    quiz.appendChild(res);
    $("[data-simpler]", res)?.addEventListener("click", () => {
      scrollTo({ top: 0, behavior: "smooth" });
      load({ tweaks: ["simpler"] });
    });
    if (pct >= 0.6) markDone();
  };

  // ---------- Explain further ----------

  const explainCache = new Map();
  const toggleExplain = async (btn) => {
    const fig = btn.closest(".block-formula");
    const panel = $(".explain-panel", fig);
    const inner = $(".explain-inner", panel);
    const open = !fig.classList.contains("explaining");
    fig.classList.toggle("explaining", open);
    btn.setAttribute("aria-expanded", String(open));
    $(".explain-btn-text", btn).textContent = open ? "Hide explanation" : "Explain further";
    if (!open) return;

    const id = fig.dataset.id;
    if (explainCache.has(id)) {
      inner.innerHTML = md(explainCache.get(id));
      return;
    }
    if (fig.dataset.loading) return;
    fig.dataset.loading = "1";
    inner.innerHTML = `<div class="dots" aria-label="Loading"><i></i><i></i><i></i></div>`;
    let text = "";
    let raf = 0;
    try {
      const full = await explainFurther(
        {
          courseId: course.id,
          topicId: topic.id,
          latex: fig.dataset.latex,
          name: fig.dataset.name,
          explanation: fig.dataset.explanation,
          profile: withDefaults(store.getProfile()),
        },
        {
          signal: abort?.signal,
          onDelta: (d) => {
            text += d;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => (inner.innerHTML = md(text) + `<span class="caret"></span>`));
          },
        }
      );
      cancelAnimationFrame(raf);
      explainCache.set(id, full);
      inner.innerHTML = md(full);
    } catch (err) {
      cancelAnimationFrame(raf);
      if (err.name === "AbortError") return;
      inner.innerHTML = `<p class="muted">${esc(err instanceof ApiError ? err.message : "Couldn't load that. Try again.")}</p>`;
    } finally {
      delete fig.dataset.loading;
    }
  };

  // ---------- Toolbar ----------

  $$("[data-tweak]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const t = b.dataset.tweak;
      load({ tweaks: activeTweaks.includes(t) ? [] : [t] });
    })
  );
  $("[data-regen]", el).addEventListener("click", () => load({ tweaks: activeTweaks, fresh: true }));

  // ---------- Start ----------

  drawAdaptRow();
  store.setLastVisited(course.id, topic.id);
  if (topicStatus(course, topic.id) === "new") store.setTopic(course.id, topic.id, { opened: true });

  if (needsOnboarding(course)) {
    body.innerHTML = `<div class="writing"><div class="writing-text"><p class="writing-title">Quick setup first</p>
      <p class="muted">Tell us what you already know so this lesson starts in the right place.</p></div></div>`;
    runOnboarding(course).then(() => {
      drawAdaptRow();
      load();
    });
  } else {
    load();
  }

  return () => {
    abort?.abort();
    clearInterval(lineTimer);
    document.body.classList.remove("is-lesson");
  };
}

// ---------- Block renderers ----------

const CALLOUT = {
  tip: { icon: "💡", label: "Tip" },
  warning: { icon: "⚠️", label: "Watch out" },
  exam: { icon: "🎯", label: "On the exam" },
  memory: { icon: "🧠", label: "Memory trick" },
};

function renderBlock(b, id) {
  switch (b.type) {
    case "text":
      return `<div class="block block-text prose reveal">${md(b.markdown)}</div>`;

    case "formula":
      return `
        <figure class="block block-formula reveal" data-id="${id}" data-latex="${esc(b.latex)}" data-name="${esc(b.name)}" data-explanation="${esc(b.explanation)}">
          ${b.name ? `<p class="formula-name">${esc(b.name)}</p>` : ""}
          <div class="formula-tex">${tex(b.latex, true)}</div>
          <figcaption class="formula-explain prose">${md(b.explanation)}</figcaption>
          ${
            b.variables?.length
              ? `<dl class="formula-vars">${b.variables
                  .map((v) => `<div><dt>${tex(v.symbol)}</dt><dd>${mdInline(v.meaning)}</dd></div>`)
                  .join("")}</dl>`
              : ""
          }
          <button type="button" class="explain-btn" aria-expanded="false">
            <span class="sparkle" aria-hidden="true">✦</span><span class="explain-btn-text">Explain further</span>
          </button>
          <div class="explain-panel"><div><div class="explain-inner prose"></div></div></div>
        </figure>`;

    case "example":
      return `
        <div class="block block-example reveal">
          <p class="example-label">Worked example${b.title ? ` · ${esc(b.title)}` : ""}</p>
          <div class="example-problem prose">${md(b.problem)}</div>
          <ol class="steps">${(b.steps || []).map((s, i) => `<li class="step" style="--i:${i}"><div class="prose">${md(s)}</div></li>`).join("")}</ol>
          <div class="example-answer"><span>Answer</span><div class="prose">${md(b.answer)}</div></div>
          <div class="example-actions">
            <button type="button" class="btn btn-sm btn-primary" data-next-step>Show first step</button>
            <button type="button" class="btn btn-sm btn-ghost" data-all-steps>Show full solution</button>
          </div>
        </div>`;

    case "callout": {
      const c = CALLOUT[b.tone] || CALLOUT.tip;
      return `
        <aside class="block block-callout tone-${esc(b.tone)} reveal">
          <span class="callout-icon" aria-hidden="true">${c.icon}</span>
          <div><p class="callout-title">${esc(b.title || c.label)}</p><div class="prose">${md(b.markdown)}</div></div>
        </aside>`;
    }

    case "analogy":
      return `<aside class="block block-analogy reveal"><span class="analogy-label">Think of it like this</span><div class="prose">${md(b.markdown)}</div></aside>`;

    case "table":
      return `
        <figure class="block block-table reveal">
          <div class="table-scroll"><table>
            <thead><tr>${(b.headers || []).map((h) => `<th>${mdInline(h)}</th>`).join("")}</tr></thead>
            <tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table></div>
          ${b.caption ? `<figcaption>${mdInline(b.caption)}</figcaption>` : ""}
        </figure>`;

    case "diagram":
      return `
        <figure class="block block-diagram reveal">
          <div class="diagram" data-mermaid="${esc(b.mermaid)}"><div class="dots"><i></i><i></i><i></i></div></div>
          ${b.caption ? `<figcaption>${mdInline(b.caption)}</figcaption>` : ""}
        </figure>`;

    case "check":
      return `
        <div class="block block-check reveal">
          <p class="check-label">Quick check</p>
          <div class="prose">${md(b.question)}</div>
          <button type="button" class="btn btn-sm btn-ghost">Reveal answer</button>
          <div class="check-answer prose">${md(b.answer)}</div>
        </div>`;

    default:
      return "";
  }
}

function renderPractice(questions) {
  return `
    <section class="practice reveal">
      <div class="practice-head"><h2>Practice like the AP exam</h2><span class="score muted">${questions.length} questions</span></div>
      ${questions
        .map(
          (q, qi) => `
        <div class="q-card" data-correct="${Number(q.correctIndex)}">
          <p class="q-num">Question ${qi + 1}</p>
          <div class="q-stem prose">${md(q.question)}</div>
          <div class="choices">
            ${(q.choices || [])
              .map(
                (c, ci) => `<button type="button" class="choice" data-i="${ci}">
                  <span class="choice-letter">${"ABCD"[ci] || ci + 1}</span><span class="prose">${mdInline(c)}</span></button>`
              )
              .join("")}
          </div>
          <div class="q-explain prose" hidden>${md(q.explanation)}</div>
        </div>`
        )
        .join("")}
    </section>`;
}
