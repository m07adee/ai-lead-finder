"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LiquidButton } from "@/components/ui/liquid-button";
import { KineticTextLoader } from "@/components/ui/kinetic-text-loader";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { LeadsTable } from "@/components/LeadsTable";
import { api, type Job, type Lead } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";

type Cat = { id: string; label: string };

function useToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only
      setToken(sessionStorage.getItem("lf-token"));
    } catch {}
  }, []);
  const save = (t: string | null) => {
    try {
      if (t) sessionStorage.setItem("lf-token", t);
      else sessionStorage.removeItem("lf-token");
    } catch {}
    setToken(t);
  };
  return [token, save] as const;
}

export default function AppPage() {
  const [token, setToken] = useToken();
  const { lang, setLang, t, cat } = useLang();
  const [cats, setCats] = useState<Cat[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [active, setActive] = useState<{ job: Job; leads: Lead[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const running = useRef<number | null>(null);

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  const loadJobs = useCallback(async (tk: string) => {
    try {
      setJobs(await api<Job[]>("/api/jobs", tk));
    } catch (e) {
      if ((e as { status?: number }).status === 401) setToken(null);
    }
  }, [setToken]);

  useEffect(() => {
    api<{ categories: Cat[] }>("/api/meta", null).then((m) => setCats(m.categories)).catch(() => {});
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the job list once signed in
    if (token) loadJobs(token);
  }, [token, loadJobs]);

  const openJob = useCallback(async (id: number) => {
    if (!token) return;
    const data = await api<{ job: Job; leads: Lead[] }>(`/api/jobs/${id}`, token);
    setActive(data);
    return data;
  }, [token]);

  /** Drive the job forward: call /step until done (each call is a short serverless request). */
  const run = useCallback(async (id: number) => {
    if (!token || running.current === id) return;
    running.current = id;
    try {
      for (let i = 0; i < 80 && running.current === id; i++) {
        const r = await api<{ job: Job; done: boolean; retry_in?: number }>(`/api/jobs/${id}/step`, token, { method: "POST", body: "{}" });
        const data = await openJob(id);
        setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...r.job } : j)));
        if (r.done || data?.job.status === "failed") break;
        if (r.retry_in) await new Promise((res) => setTimeout(res, r.retry_in! * 1000));
      }
    } catch (e) {
      flash(false, (e as Error).message);
    } finally {
      if (running.current === id) running.current = null;
      loadJobs(token);
    }
  }, [token, openJob, loadJobs]);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tk = String(new FormData(e.currentTarget).get("token") || "").trim();
    try {
      await api("/api/jobs", tk);
      setToken(tk);
    } catch {
      flash(false, t.login.wrong);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const job = await api<Job>("/api/jobs", token, { method: "POST", body: JSON.stringify({ ...d, limit: Number(d.limit) }) });
      setJobs((j) => [job, ...j]);
      setActive({ job, leads: [] });
      run(job.id);
    } catch (err) {
      flash(false, (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "csv" | "xlsx") {
    if (!token || !active) return;
    const res = await fetch(`/api/jobs/${active.job.id}/export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return flash(false, t.job.exportFail);
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || `leads.${format}`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function togglePublic() {
    if (!token || !active) return;
    await api(`/api/jobs/${active.job.id}`, token, { method: "PATCH", body: JSON.stringify({ is_public: !active.job.is_public }) });
    await openJob(active.job.id);
    loadJobs(token);
    flash(true, active.job.is_public ? t.job.demoOff : t.job.demoOn);
  }

  async function remove() {
    if (!token || !active || !confirm(t.job.confirmDel)) return;
    running.current = null;
    await api(`/api/jobs/${active.job.id}`, token, { method: "DELETE" });
    setActive(null);
    loadJobs(token);
  }

  if (!token)
    return (
      <div className="relative grid min-h-dvh place-items-center px-4">
        <motion.form onSubmit={login} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[.04] p-8">
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl">🎯</div>
          <div className="absolute end-4 top-4"><LangSwitch lang={lang} onChange={setLang} /></div>
          <h1 className="text-xl font-bold">{t.brand}</h1>
          <p className="mb-5 mt-1 text-sm text-white/50">{t.login.sub}</p>
          <input name="token" type="password" autoComplete="current-password" autoFocus className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400" placeholder={t.login.placeholder} dir="ltr" />
          <button className="mt-4 w-full rounded-xl bg-indigo-500 py-3 font-semibold transition hover:bg-indigo-400" type="submit">{t.login.button}</button>
          <Link href="/demo" className="mt-4 block text-center text-sm text-white/50 hover:text-white">{t.login.demo}</Link>
          {toast && <p className="mt-3 text-sm text-rose-400">{toast.text}</p>}
        </motion.form>
      </div>
    );

  const j = active?.job;
  const pct = j && j.total ? Math.round((j.processed / j.total) * 100) : 0;
  const leads = active?.leads || [];
  const withEmail = leads.filter((l) => l.email).length;
  const hot = leads.filter((l) => l.score >= 60).length;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070816]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">🎯</span>{t.brand}</Link>
          <div className="flex items-center gap-1 text-sm">
            <LangSwitch lang={lang} onChange={setLang} />
            <Link href="/demo" className="rounded-lg px-3 py-1.5 text-white/60 hover:bg-white/5 hover:text-white">{t.nav.publicDemo}</Link>
            <button type="button" onClick={() => setToken(null)} className="rounded-lg px-3 py-1.5 text-white/60 hover:bg-white/5 hover:text-white">{t.nav.signOut}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
        {/* left: new search + history */}
        <aside className="space-y-5">
          <form onSubmit={create} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h2 className="mb-4 font-semibold">{t.form.title}</h2>
            <label className="mb-1 block text-xs text-white/50">{t.form.type}</label>
            <select name="category" required className="lf-input mb-3" defaultValue="dentist">
              {cats.map((c) => <option key={c.id} value={c.id}>{cat(c.id, c.label)}</option>)}
            </select>
            <label className="mb-1 block text-xs text-white/50">{t.form.city}</label>
            <input name="city" required placeholder={t.form.cityPh} className="lf-input mb-3" />
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-white/50">{t.form.emailLang}</label>
                <select name="lang" className="lf-input" key={lang} defaultValue={lang}>
                  <option value="en">English</option><option value="ar">العربية</option><option value="tr">Türkçe</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">{t.form.max}</label>
                <select name="limit" className="lf-input" defaultValue="20">
                  {[10, 20, 30, 40, 60].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <LiquidButton type="submit" variant="dark" size="default" disabled={busy} className="w-full font-semibold" fillColor="#6366f1" borderColor="#818cf8" activeTextColor="#ffffff">
              {busy ? t.form.starting : t.form.find}
            </LiquidButton>
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">{t.form.note}</p>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-2">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/40">{t.jobs.title}</div>
            {jobs.length === 0 && <p className="px-3 pb-3 text-sm text-white/40">{t.jobs.empty}</p>}
            {jobs.map((x) => (
              <button key={x.id} type="button" onClick={async () => { const d = await openJob(x.id); if (d && (d.job.status === "running" || d.job.status === "searching")) run(x.id); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition ${active?.job.id === x.id ? "bg-indigo-500/20" : "hover:bg-white/5"}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${x.status === "done" ? "bg-emerald-400" : x.status === "failed" ? "bg-rose-400" : "animate-pulse bg-amber-400"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{cat(x.category, cats.find((c) => c.id === x.category)?.label)}</span>
                  <span className="block truncate text-xs text-white/45">{x.city}</span>
                </span>
                <span className="text-xs text-white/40">{x.total}{x.is_public ? " · 🌍" : ""}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* right: results */}
        <section className="min-w-0">
          <AnimatePresence mode="wait">
            {!j ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid min-h-[50vh] place-items-center rounded-3xl border border-dashed border-white/10 p-10 text-center">
                <div>
                  <div className="text-5xl">🗺️</div>
                  <p className="mt-4 text-lg font-semibold">{t.empty.title}</p>
                  <p className="mt-1 text-sm text-white/50">{t.empty.sub}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={j.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold">{cat(j.category, cats.find((c) => c.id === j.category)?.label)} · <span className="text-indigo-300">{j.city}</span></h1>
                    <p className="text-sm text-white/45">{j.city_label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => download("xlsx")} disabled={j.status !== "done"} className="rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40">{t.job.excel}</button>
                    <button type="button" onClick={() => download("csv")} disabled={j.status !== "done"} className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-40">{t.job.csv}</button>
                    <button type="button" onClick={togglePublic} disabled={j.status !== "done"} className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-40">{j.is_public ? t.job.onDemo : t.job.showDemo}</button>
                    <button type="button" onClick={remove} className="rounded-xl px-3.5 py-2 text-sm text-rose-300 hover:bg-rose-500/10">{t.job.del}</button>
                  </div>
                </div>

                {(j.status === "searching" || j.status === "running") && (
                  <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[.07] p-5">
                    <div className="flex flex-wrap items-center gap-6">
                      <KineticTextLoader text="Loading" className="scale-75 text-white" />
                      <div className="min-w-[220px] flex-1">
                        <p className="font-semibold">{j.status === "searching" ? (j.attempts ? t.job.busy : t.job.searching) : t.job.auditing(j.processed, j.total)}</p>
                        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" animate={{ width: j.status === "searching" ? "6%" : `${Math.max(pct, 6)}%` }} transition={{ type: "spring", stiffness: 60, damping: 20 }} />
                        </div>
                        <p className="mt-2 text-xs text-white/45">{t.job.keepOpen}</p>
                      </div>
                    </div>
                  </div>
                )}
                {j.status === "failed" && <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{j.error || t.job.failed}</div>}

                {leads.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {([[t.stats.businesses, leads.length, "🏢"], [t.stats.high, hot, "🔥"], [t.stats.email, withEmail, "✉️"], [t.stats.ai, leads.filter((l) => l.ai.message).length, "✍️"]] as const).map(([label, v, icon]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                        <div className="text-xs text-white/45">{icon} {label}</div>
                        <div className="mt-1 flex justify-start text-2xl font-bold"><span dir="ltr" className="inline-flex"><AnimatedNumber value={v} /></span></div>
                      </div>
                    ))}
                  </div>
                )}
                <LeadsTable leads={leads} t={t.table} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl ${toast.ok ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"}`}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
