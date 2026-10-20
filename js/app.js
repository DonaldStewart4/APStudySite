import { auth } from "./auth.js";
import { store } from "./store.js";
import { esc } from "./render.js";
import { $, $$, reducedMotion, toast } from "./ui.js";
import { openSignIn } from "./components/signin.js";
import { renderHome } from "./views/home.js";
import { renderCourse } from "./views/course.js";
import { renderLesson } from "./views/lesson.js";
import { renderStyle } from "./views/style.js";

// ---------- Routing (hash-based, so it works on any static host) ----------
//   #/                       home
//   #/course/<courseId>      course overview
//   #/learn/<courseId>/<id>  lesson
//   #/style                  learning style settings

const routes = [
  { re: /^\/?$/, view: renderHome, nav: "home" },
  { re: /^\/course\/([\w-]+)\/?$/, view: (el, [id]) => renderCourse(el, id), nav: "home" },
  { re: /^\/learn\/([\w-]+)\/([\d.]+)\/?$/, view: (el, [c, t]) => renderLesson(el, c, t), nav: "home" },
  { re: /^\/style\/?$/, view: renderStyle, nav: "style" },
];

let cleanup = null;
let lastPath = null;

async function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  if (path === lastPath) return;
  lastPath = path;

  const match = routes.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m);
  const app = $("#app");

  const swap = async () => {
    cleanup?.();
    cleanup = null;
    app.innerHTML = "";
    document.title = "Road to 5 · AP Study";
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!match) {
      app.innerHTML = `<section class="container empty-state"><h1>Page not found</h1><p><a class="btn" href="#/">Back to courses</a></p></section>`;
      return;
    }
    $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === match.r.nav));
    cleanup = (await match.r.view(app, match.m.slice(1))) || null;
    app.focus({ preventScroll: true });
  };

  if (document.startViewTransition && !reducedMotion()) {
    document.startViewTransition(swap);
  } else {
    await swap();
  }
}

// ---------- Theme ----------

function applyTheme() {
  const explicit = document.documentElement.dataset.theme;
  const dark = explicit ? explicit === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.resolvedTheme = dark ? "dark" : "light";
}

function initTheme() {
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.resolvedTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("r5:theme", next);
    } catch {}
    applyTheme();
  });
}

// ---------- Auth button ----------

function renderAuthSlot() {
  const slot = $("#auth-slot");
  if (auth.user) {
    const name = auth.displayName();
    slot.innerHTML = `
      <div class="user-menu">
        <button class="avatar-btn" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="avatar">${esc(name[0]?.toUpperCase() || "S")}</span>
          <span class="avatar-name">${esc(name)}</span>
        </button>
        <div class="user-pop" hidden>
          <p class="muted small">Signed in as<br><strong>${esc(auth.user.email || name)}</strong></p>
          <button class="btn btn-ghost btn-sm" type="button" data-signout>Sign out</button>
        </div>
      </div>`;
    const btn = $(".avatar-btn", slot);
    const pop = $(".user-pop", slot);
    btn.addEventListener("click", () => {
      pop.hidden = !pop.hidden;
      btn.setAttribute("aria-expanded", String(!pop.hidden));
    });
    $("[data-signout]", slot).addEventListener("click", async () => {
      await auth.signOut();
      toast("Signed out. Your progress stays on this device.");
    });
  } else {
    slot.innerHTML = `<button class="btn btn-sm" type="button" id="signin-btn">Sign in</button>`;
    $("#signin-btn").addEventListener("click", openSignIn);
  }
}

// ---------- Reading progress bar (used on lesson pages) ----------

function initReadProgress() {
  const bar = $(".read-progress span");
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const on = document.body.classList.contains("is-lesson");
    bar.style.transform = `scaleX(${on && max > 0 ? Math.min(1, doc.scrollTop / max) : 0})`;
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
}

function initHeaderShadow() {
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// ---------- Boot ----------

async function boot() {
  initTheme();
  initReadProgress();
  initHeaderShadow();
  renderAuthSlot();
  addEventListener("hashchange", route);
  await route();

  await auth.init();
  renderAuthSlot();
  if (auth.user) await store.syncFromRemote();
  auth.onChange(async (user) => {
    renderAuthSlot();
    if (user) {
      toast(`Welcome, ${auth.displayName()}! Syncing your progress…`, { type: "good" });
      await store.syncFromRemote();
      lastPath = null;
      route();
    }
  });
}

boot();
