"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { KineticTextLoader } from "@/components/ui/kinetic-text-loader";
import { AnimatedNumber } from "@/components/ui/animated-number";
import StaggerText from "@/components/ui/staggerText";
import { LeadsTable } from "@/components/LeadsTable";
import { api, type Job, type Lead } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";

/** Public, read-only results of one real search (contact details masked). */
export default function Demo() {
  const { lang, setLang, t } = useLang();
  const [data, setData] = useState<{ job: Job | null; leads: Lead[] } | null>(null);
  useEffect(() => {
    api<{ job: Job | null; leads: Lead[] }>("/api/demo", null).then(setData).catch(() => setData({ job: null, leads: [] }));
  }, []);
  const leads = data?.leads || [];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">🎯</span>{t.brand}</Link>
          <div className="flex items-center gap-2">
            <LangSwitch lang={lang} onChange={setLang} />
            <Link href="/app" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">{t.nav.openApp}</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!data ? (
          <div className="grid place-items-center py-24"><KineticTextLoader text="Loading" className="text-white" /></div>
        ) : !data.job ? (
          <p className="py-24 text-center text-white/50">{t.demo.none}</p>
        ) : (
          <>
            <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/30">{t.demo.badge}</span>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl"><StaggerText key={lang}>{t.demo.title(leads.length, data.job.city)}</StaggerText></h1>
            <p className="mt-2 text-white/55">{t.demo.sub}</p>
            <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {([[t.stats.businesses, leads.length, "🏢"], [t.stats.high, leads.filter((l) => l.score >= 60).length, "🔥"], [t.stats.email, leads.filter((l) => l.email).length, "✉️"], [t.stats.ai, leads.filter((l) => l.ai.message).length, "✍️"]] as const).map(([label, v, icon], i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                  <div className="text-xs text-white/45">{icon} {label}</div>
                  <div className="mt-1 flex justify-start text-2xl font-bold"><span dir="ltr" className="inline-flex"><AnimatedNumber value={v} /></span></div>
                </motion.div>
              ))}
            </div>
            <LeadsTable leads={leads} masked t={t.table} />
          </>
        )}
      </main>
    </div>
  );
}
