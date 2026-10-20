import { auth } from "../auth.js";
import { CONFIG } from "../config.js";
import { openModal, toast, $ } from "../ui.js";

export function openSignIn() {
  if (!auth.enabled) {
    const soon = openModal({
      label: "Accounts coming soon",
      size: "sm",
      html: `
        <div class="modal-hero-icon">🔐</div>
        <h2>Accounts are coming soon</h2>
        <p class="muted">For now, your progress, learning style, and lessons are saved on this device automatically.
        When sign-in launches, everything here will carry over to your account.</p>
        <button class="btn btn-primary btn-block" type="button" data-close autofocus>Got it</button>`,
    });
    soon.el.querySelector("[data-close]").addEventListener("click", () => soon.close());
    return;
  }

  const providers = CONFIG.authProviders;
  const { el, close } = openModal({
    label: "Sign in",
    size: "sm",
    html: `
      <div class="modal-hero-icon">👋</div>
      <h2>Sign in to sync your progress</h2>
      <p class="muted">Pick up where you left off on any device.</p>
      ${providers.includes("google") ? `<button class="btn btn-block btn-oauth" type="button" data-provider="google"><span aria-hidden="true">G</span> Continue with Google</button>` : ""}
      ${providers.includes("email") ? `
        <div class="divider"><span>or use email</span></div>
        <form class="signin-form">
          <label class="field-label" for="signin-email">Email</label>
          <input id="signin-email" class="input" type="email" required autocomplete="email" placeholder="you@school.edu" autofocus />
          <button class="btn btn-primary btn-block" type="submit">Email me a sign-in link</button>
        </form>` : ""}`,
  });

  el.querySelectorAll("[data-provider]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await auth.signInWithProvider(b.dataset.provider);
      } catch (err) {
        toast(err.message || "Sign-in failed.", { type: "bad" });
      }
    })
  );

  $(".signin-form", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      await auth.signInWithEmail($("#signin-email", el).value.trim());
      close();
      toast("Check your email for a sign-in link.", { type: "good", timeout: 7000 });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Email me a sign-in link";
      toast(err.message || "Couldn't send the link.", { type: "bad" });
    }
  });
}
