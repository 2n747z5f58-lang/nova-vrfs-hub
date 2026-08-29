import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Loader2, Volume2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { playUiSound } from "@/lib/sounds";

export const Route = createFileRoute("/auth")({ ssr: false, component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    if (!isSupabaseConfigured) { setError("Connect Supabase to enable sign-in."); setBusy(false); playUiSound("error"); return; }
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth-callback` } });
    if (result.error) { setError(result.error.message); playUiSound("error"); setBusy(false); return; }
    playUiSound("success");
    if (result.data.session) void navigate({ to: "/" }); else setMessage("Check your email to confirm your account.");
    setBusy(false);
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10"><div className="w-full max-w-md"><div className="mb-10 flex items-center gap-3"><img src="/nova-icon.jpeg" alt="NOVA" className="size-10 rounded-lg object-cover" /><span className="font-black tracking-[0.28em]">NOVA</span></div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">VRFS / Secure access</p><h1 className="text-4xl font-bold tracking-tight">{mode === "signin" ? "Welcome back." : "Create your account."}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Access league operations, fixtures and player statistics from one professional workspace.</p><button type="button" onClick={async () => { setBusy(true); setError(""); setMessage(""); if (!isSupabaseConfigured) { setError("Connect Supabase to enable Discord sign-in."); setBusy(false); playUiSound("error"); return; } const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/auth-callback` } }); if (oauthError) { setError(oauthError.message); playUiSound("error"); setBusy(false); } }} disabled={busy} className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-card font-semibold text-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-accent active:translate-y-0 disabled:opacity-60"><span className="grid size-5 place-items-center rounded-sm bg-[#5865F2] text-[11px] font-black text-white">D</span>Continue with Discord</button><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>or continue with email</span><span className="h-px flex-1 bg-border" /></div><form onSubmit={submit} className="space-y-5"><div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none focus:border-foreground" /></div><div><label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label><input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none focus:border-foreground" /></div>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-black/20 hover:opacity-90 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></button></form><button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }} className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">{mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}</button><p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground"><Volume2 className="size-3" /> Interface sounds are controlled in your profile.</p></div></main>;
}
