"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Lead } from "@/lib/types";
import type { Dict } from "@/lib/i18n";

const FILTERS = ["all", "high", "email", "nosite"] as const;

function scoreColor(s: number) {
  return s >= 60 ? "from-rose-500 to-orange-400" : s >= 35 ? "from-amber-400 to-yellow-300" : "from-slate-500 to-slate-400";
}

function CopyButton({ text, label, copied }: { text: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
    >
      {done ? copied : label}
    </button>
  );
}

export function LeadsTable({ leads, masked = false, t }: { leads: Lead[]; masked?: boolean; t: Dict["table"] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const shown = useMemo(() => leads.filter((l) => {
    if (l.status !== "done") return false;
    if (q && !`${l.name} ${l.address}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "high") return l.score >= 60 || l.ai.priority === "high";
    if (filter === "email") return !!l.email;
    if (filter === "nosite") return !l.signals.has_website || l.signals.reachable === false;
    return true;
  }), [leads, filter, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${filter === f ? "text-white" : "text-white/55 hover:text-white"}`}>
            {filter === f && <motion.span layoutId="lead-filter" className="absolute inset-0 rounded-full bg-indigo-500/80" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative">{t.filters[f]}</span>
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="ms-auto w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400 sm:w-64" />
      </div>

      {shown.length === 0 && <p className="py-12 text-center text-sm text-white/40">{t.none}</p>}

      <ul className="space-y-2">
        {shown.map((l, i) => {
          const isOpen = open === l.id;
          return (
            <motion.li key={l.id} layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-indigo-400/40 bg-white/[.06]" : "border-white/10 bg-white/[.03] hover:bg-white/[.05]"}`}>
              <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-center gap-4 px-4 py-3 text-start">
                <div dir="ltr" className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${scoreColor(l.score)} text-sm font-black text-slate-950`}>{l.score}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{l.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(l.ai.opportunities || []).slice(0, 3).map((o) => <span key={o} className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] text-rose-200">{o}</span>)}
                  </div>
                </div>
                <div className="hidden shrink-0 gap-1.5 text-base sm:flex" aria-label="contact channels">
                  <span title="Email" className={l.email ? "" : "opacity-20"}>✉️</span>
                  <span title="Phone" className={l.phone ? "" : "opacity-20"}>📞</span>
                  <span title="Website" className={l.website ? "" : "opacity-20"}>🌐</span>
                  <span title="Social profiles" className={Object.keys(l.socials).length ? "" : "opacity-20"}>📱</span>
                </div>
                <span className={`text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <div className="grid gap-5 border-t border-white/10 px-4 py-4 text-sm md:grid-cols-[1fr_1.2fr]">
                      <div className="space-y-3">
                        <p dir="auto" className="text-white/80">{l.ai.summary}</p>
                        <dl className="space-y-1.5 text-white/70">
                          {l.email && <div><dt className="inline text-white/40">{t.email}: </dt><dd className="inline" dir="ltr">{masked ? l.email : <a className="text-indigo-300 hover:underline" href={`mailto:${l.email}`}>{l.email}</a>}</dd></div>}
                          {l.phone && <div><dt className="inline text-white/40">{t.phone}: </dt><dd className="inline" dir="ltr">{l.phone}</dd></div>}
                          {l.website && <div><dt className="inline text-white/40">{t.website}: </dt><dd className="inline break-all" dir="ltr"><a className="text-indigo-300 hover:underline" href={/^https?:/.test(l.website) ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer">{l.website}</a></dd></div>}
                          {l.address && <div><dt className="inline text-white/40">{t.address}: </dt><dd className="inline">{l.address}</dd></div>}
                        </dl>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(l.socials).map(([k, v]) => <a key={k} href={v.startsWith("http") ? v : `https://${k}.com/${v.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-2.5 py-1 text-xs capitalize hover:bg-white/20">{k}</a>)}
                          {l.lat && l.lon && <a href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=18/${l.lat}/${l.lon}`} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20">{t.map}</a>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-white/50">
                          {l.signals.has_website === false && <span>{t.noSite}</span>}
                          {l.signals.reachable && <span>{l.signals.https ? t.https : t.noHttps} · {l.signals.mobile_friendly ? t.mobile : t.noMobile} · {l.signals.has_booking ? t.booking : t.noBooking} · {l.signals.has_chat ? t.chat : t.noChat} · <span dir="ltr">{l.signals.response_ms}ms</span>{l.signals.tech?.length ? ` · ${l.signals.tech.join(", ")}` : ""}</span>}
                        </div>
                        {(l.ai.services || []).length > 0 && (
                          <div>
                            <div className="mb-1 text-xs text-white/40">{t.pitch}</div>
                            <div className="flex flex-wrap gap-1.5">{l.ai.services!.map((s) => <span key={s} className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">{s}</span>)}</div>
                          </div>
                        )}
                      </div>
                      {l.ai.message ? (
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs text-white/40">{t.draft}</span>
                            <div className="flex gap-1.5">
                              <CopyButton text={l.ai.subject || ""} label={t.copySubject} copied={t.copied} />
                              <CopyButton text={l.ai.message} label={t.copyMessage} copied={t.copied} />
                            </div>
                          </div>
                          {l.ai.subject && <p dir="auto" className="mb-2 font-semibold text-white/90">{l.ai.subject}</p>}
                          <p dir="auto" className="whitespace-pre-line leading-relaxed text-white/75">{l.ai.message}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-white/40">{t.noDraft}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
