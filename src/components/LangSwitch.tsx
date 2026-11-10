"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LANGS, type Lang } from "@/lib/i18n";

/** Segmented language switch with a spring pill; keeps LTR order so it doesn't jump in RTL. */
export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const refs = useRef<Partial<Record<Lang, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });
  const measure = useCallback(() => {
    const el = refs.current[lang];
    if (el) setPill((p) => ({ x: el.offsetLeft, w: el.offsetWidth, ready: p.ready || el.offsetWidth > 0 }));
  }, [lang]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div dir="ltr" role="radiogroup" aria-label="Language" className="relative flex rounded-full border border-white/10 bg-white/5 p-1">
      <motion.span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 shadow-[0_4px_14px_-4px_rgba(99,102,241,.7)]"
        initial={false}
        animate={{ x: pill.x, width: pill.w, opacity: pill.ready ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      />
      {LANGS.map((l) => (
        <motion.button
          key={l.id}
          ref={(el) => {
            refs.current[l.id] = el;
          }}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          onClick={() => onChange(l.id)}
          whileTap={{ scale: 0.92 }}
          className={`relative z-10 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${lang === l.id ? "text-white" : "text-white/55 hover:bg-white/[.06] hover:text-white"}`}
        >
          {l.label}
        </motion.button>
      ))}
    </div>
  );
}
