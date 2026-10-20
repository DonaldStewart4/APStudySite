// Public, browser-side configuration.
//
// To turn on accounts later: create a Supabase project, run
// supabase/schema.sql in its SQL editor, then paste the project URL and the
// anon (public) key below. The anon key is safe to ship to browsers; row-level
// security in schema.sql keeps each student's data private.
export const CONFIG = {
  siteName: "Road to 5",
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Sign-in methods shown when Supabase is configured. Enable the matching
  // providers in Supabase → Authentication → Providers.
  authProviders: ["email", "google"],
};

export const authEnabled = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
