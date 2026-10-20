// Authentication, ready for Supabase.
//
// Until CONFIG.supabaseUrl / supabaseAnonKey are set, auth is disabled: the
// site works fully offline-first with progress saved in the browser, and the
// "Sign in" button explains that accounts are coming soon.
//
// Once configured, this module lazily loads supabase-js, restores the
// session, and exposes a tiny API the rest of the app uses:
//   auth.user            current user or null
//   auth.onChange(fn)    subscribe to sign-in / sign-out
//   auth.signInWithEmail(email)   magic link
//   auth.signInWithProvider("google")
//   auth.signOut()
//   auth.client()        the Supabase client (used by store.js to sync)

import { CONFIG, authEnabled } from "./config.js";

const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabase = null;
const listeners = new Set();

export const auth = {
  user: null,
  enabled: authEnabled(),

  async init() {
    if (!this.enabled) return;
    try {
      const { createClient } = await import(SUPABASE_ESM);
      supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data } = await supabase.auth.getSession();
      this.user = data.session?.user ?? null;
      supabase.auth.onAuthStateChange((_event, session) => {
        const next = session?.user ?? null;
        if (next?.id === this.user?.id) return;
        this.user = next;
        listeners.forEach((fn) => fn(this.user));
      });
    } catch (err) {
      console.error("Supabase failed to load; continuing without accounts.", err);
      this.enabled = false;
    }
  },

  client() {
    return supabase;
  },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  async signInWithEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  },

  async signInWithProvider(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  },

  async signOut() {
    await supabase?.auth.signOut();
  },

  displayName() {
    const u = this.user;
    if (!u) return "";
    return u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Student";
  },
};
