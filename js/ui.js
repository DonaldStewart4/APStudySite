// Small UI helpers: modals, toasts, scroll reveals, confetti, counters.

import { esc } from "./render.js";

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

// ---------- Toasts ----------

export function toast(message, { type = "info", action, onAction, timeout = 4200 } = {}) {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
  root.appendChild(el);
  const close = () => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  if (action) {
    el.querySelector("button").addEventListener("click", () => {
      onAction?.();
      close();
    });
  }
  setTimeout(close, timeout);
  return close;
}

// ---------- Modal ----------

export function openModal({ html, label = "Dialog", size = "md", dismissable = true, onClose }) {
  const root = $("#modal-root");
  const previous = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">
      ${dismissable ? `<button class="modal-close icon-btn" type="button" aria-label="Close">✕</button>` : ""}
      <div class="modal-body">${html}</div>
    </div>`;
  root.appendChild(wrap);
  document.body.classList.add("modal-open");
  const modal = $(".modal", wrap);
  requestAnimationFrame(() => {
    wrap.classList.add("open");
    ($("[autofocus]", modal) || modal).focus();
  });

  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove("open");
    wrap.classList.add("closing");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => {
      wrap.remove();
      if (!$(".modal-wrap", root)) document.body.classList.remove("modal-open");
      previous?.focus?.();
    }, reducedMotion() ? 0 : 260);
    onClose?.(result);
  };
  const onKey = (e) => {
    if (e.key === "Escape" && dismissable) close();
    if (e.key === "Tab") trapFocus(e, modal);
  };
  document.addEventListener("keydown", onKey);
  if (dismissable) {
    $(".modal-backdrop", wrap).addEventListener("click", () => close());
    $(".modal-close", wrap).addEventListener("click", () => close());
  }
  return { el: modal, close };
}

function trapFocus(e, modal) {
  const f = $$('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])', modal).filter(
    (n) => !n.disabled && n.offsetParent !== null
  );
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}

// ---------- Scroll reveal ----------

let observer;
export function reveal(root = document) {
  const items = $$(".reveal:not(.in)", root);
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((n) => n.classList.add("in"));
    return;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          observer.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  items.forEach((n) => observer.observe(n));
}

// ---------- Counters ----------

export function countUp(el, to, duration = 1200) {
  if (reducedMotion()) {
    el.textContent = to.toLocaleString();
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = Math.round(to * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Progress ring ----------

export function ring(pct, { size = 44, stroke = 4, label = true } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<span class="ring" style="--size:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" />
      <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${c.toFixed(2)}" style="--c:${c.toFixed(2)};--off:${off.toFixed(2)}" />
    </svg>
    ${label ? `<span class="ring-label">${Math.round(pct * 100)}%</span>` : ""}
  </span>`;
}

// ---------- Confetti ----------

export function confetti(x, y, count = 26) {
  if (reducedMotion()) return;
  const colors = ["#ff5a36", "#ffb020", "#14a06f", "#3b6ef5", "#9b5cf0"];
  const layer = document.createElement("div");
  layer.className = "confetti";
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};
      --dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 60}px;--r:${Math.random() * 720 - 360}deg;
      animation-delay:${Math.random() * 60}ms`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1300);
}

// Smoothly animates an element's height while its content changes.
export function autoHeight(el, change) {
  if (reducedMotion()) return change();
  const from = el.offsetHeight;
  change();
  const to = el.offsetHeight;
  if (from === to) return;
  el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
}
