"use client";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import StaggerText from "@/components/ui/staggerText";
import { LiquidButton } from "@/components/ui/liquid-button";
import { useLang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";

const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } }),
};



export default function Home() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(50rem_30rem_at_80%_-10%,rgba(99,102,241,.25),transparent_60%),radial-gradient(40rem_30rem_at_0%_20%,rgba(217,70,239,.14),transparent_60%)]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500">🎯</span>{t.brand}</span>
        <nav className="flex items-center gap-1 text-sm">
          <LangSwitch lang={lang} onChange={setLang} />
          <Link href="/demo" className="rounded-lg px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white">{t.nav.demo}</Link>
          <Link href="/app" className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/20">{t.nav.app}</Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4">
        <section className="py-16 text-center md:py-24">
          <motion.span variants={rise} initial="hidden" animate="show" className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-white/10">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {t.landing.badge}
          </motion.span>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            <StaggerText key={lang}>{t.landing.title}</StaggerText>
          </h1>
          <motion.p variants={rise} custom={2} initial="hidden" animate="show" className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            {t.landing.sub}
          </motion.p>
          <motion.div variants={rise} custom={3} initial="hidden" animate="show" className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/demo">
              <LiquidButton size="lg" variant="dark" fillColor="#6366f1" borderColor="#818cf8" activeTextColor="#ffffff">{t.landing.ctaDemo}</LiquidButton>
            </Link>
            <Link href="/app" className="rounded-full px-6 py-3.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white">{t.landing.ctaApp}</Link>
          </motion.div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-5">
          {t.landing.steps.map((s, i) => (
            <motion.div key={s.title} variants={rise} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} whileHover={{ y: -6 }} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-xl">{s.icon}</span>
                <span className="text-xs font-bold text-white/30">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{s.text}</p>
            </motion.div>
          ))}
        </section>
      </main>
      <footer className="relative border-t border-white/10 py-6 text-center text-xs text-white/40">
        {t.landing.footer}
      </footer>
    </div>
  );
}
