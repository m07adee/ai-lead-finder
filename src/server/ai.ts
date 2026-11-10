/** One AI call per batch: opportunity summary, recommended services and a personalized outreach draft. */
import Anthropic from "@anthropic-ai/sdk";
import { config, type AiResult, type Signals } from "./db";

const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 2, timeout: 55_000 });
const LANG: Record<string, string> = { en: "English", ar: "Arabic", tr: "Turkish" };

export type AiInput = { id: number; name: string; category: string; city: string; website: string; score: number; signals: Signals; socials: string[] };

function instructions(lang: string) {
  return `You help ${config.sender} (${config.senderTitle}) find clients. He offers: websites, web apps, mobile apps, online booking systems, AI chatbots / customer-support assistants, WhatsApp automation and business process automation.

For the business in the JSON input, return ONE JSON object with:
- "id": same id as the input
- "priority": "high" | "medium" | "low" (based mainly on the given opportunity score: >=60 high, 35-59 medium, else low)
- "summary": one factual sentence in ${LANG[lang] || "English"} about their current online presence, using ONLY the given signals (never invent facts)
- "opportunities": 1-4 short phrases in ${LANG[lang] || "English"}, e.g. (English examples) "No website", "No online booking", "No live chat", "Site not mobile-friendly", "Outdated site (©2019)", "No HTTPS", "Slow website", "Broken SSL certificate", "Website down"
- "services": 1-3 of his services that fit best, written in ${LANG[lang] || "English"}
- "subject": a short, specific email subject line in ${LANG[lang] || "English"}
- "message": a friendly, non-pushy cold email in ${LANG[lang] || "English"} (70-110 words): greet the business by name, mention ONE concrete observation from the signals, explain the benefit in one sentence, offer a free 15-minute call, and sign exactly as "${config.sender}" on its own line. No fake claims, no prices, no "I noticed you're struggling", no emojis.

Do not explain or plan. Output ONLY the JSON object, starting with { and ending with }.`;
}

/** Deterministic fallback so a lead is never left without text if the AI call fails. */
const FB: Record<string, Record<string, string>> = {
  ar: {
    "No website": "لا يوجد موقع", "Broken SSL certificate": "شهادة SSL معطلة", "Website domain not working": "الدومين لا يعمل",
    "Website too slow / timing out": "الموقع بطيء جداً", "Website unreachable": "الموقع لا يفتح", "No online booking": "لا يوجد حجز أونلاين",
    "No live chat": "لا يوجد شات مباشر", "Site not mobile-friendly": "غير متوافق مع الجوال", "No HTTPS": "بدون HTTPS",
    "AI chatbot": "شات بوت ذكي", "Online booking system": "نظام حجز أونلاين", Website: "موقع إلكتروني",
  },
};

function fallback(x: AiInput, lang = "en"): AiResult {
  const s = x.signals;
  const tr = (v: string) => FB[lang]?.[v] || v;
  const opp = [
    !s.has_website && "No website",
    s.has_website && s.reachable === false && ({ ssl_error: "Broken SSL certificate", domain_not_found: "Website domain not working", timeout: "Website too slow / timing out" }[s.error || ""] || "Website unreachable"),
    s.reachable && !s.has_booking && "No online booking",
    s.reachable && !s.has_chat && "No live chat",
    s.reachable && !s.mobile_friendly && "Site not mobile-friendly",
    s.reachable && s.https === false && "No HTTPS",
  ].filter(Boolean) as string[];
  return {
    priority: x.score >= 60 ? "high" : x.score >= 35 ? "medium" : "low",
    summary: lang === "ar"
      ? (s.has_website ? `لدى ${x.name} موقع إلكتروني${s.reachable === false ? " لكنه لا يفتح" : ""}.` : `لا يوجد موقع إلكتروني مسجل لـ ${x.name}.`)
      : (s.has_website ? `${x.name} has a website${s.reachable === false ? " that could not be reached" : ""}.` : `${x.name} has no website listed.`),
    opportunities: opp.slice(0, 4).map(tr),
    services: (s.has_website ? ["AI chatbot", "Online booking system"] : ["Website", "Online booking system"]).map(tr),
    subject: "",
    message: "",
  };
}

/** Find every balanced top-level {...} in free text (string-aware) and return the ones that parse. */
function jsonObjects(text: string): (AiResult & { id?: number })[] {
  const found: (AiResult & { id?: number })[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"' && depth > 0) inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0 && --depth === 0) {
      try {
        found.push(JSON.parse(text.slice(start, i + 1)));
      } catch {}
    }
  }
  return found;
}

function clean(r: AiResult): AiResult {
  return {
    priority: ["high", "medium", "low"].includes(r.priority || "") ? r.priority : undefined,
    summary: String(r.summary || "").slice(0, 300),
    opportunities: (Array.isArray(r.opportunities) ? r.opportunities : []).map(String).slice(0, 4),
    services: (Array.isArray(r.services) ? r.services : []).map(String).slice(0, 3),
    subject: String(r.subject || "").slice(0, 150),
    message: String(r.message || "").slice(0, 1500),
  };
}

export async function analyzeBatch(items: AiInput[], lang: string): Promise<Map<number, AiResult>> {
  const out = new Map<number, AiResult>();
  if (!items.length) return out;
  // One small request per business, all in parallel: short outputs never get truncated, and one
  // failure does not lose the whole batch.
  const started = Date.now();
  await Promise.all(items.map(async (x) => {
    const payload = { id: x.id, name: x.name, category: x.category, city: x.city, website: x.website || null, opportunity_score: x.score, signals: x.signals, social_profiles: x.socials };
    // retry once only if there is still time left in the serverless request budget
    for (let attempt = 0; attempt < 2 && !out.has(x.id) && (attempt === 0 || Date.now() - started < 20_000); attempt++) {
      try {
        // Instructions live in the user turn too: some Anthropic-compatible gateways drop `system`.
        const msg = await client.messages.create({
          model: config.model,
          max_tokens: 2000,
          system: instructions(lang),
          messages: [{ role: "user", content: `${instructions(lang)}\n\nINPUT:\n${JSON.stringify(payload)}` }],
          output_config: { effort: "low" },
        } as Anthropic.MessageCreateParamsNonStreaming, { timeout: 24_000, maxRetries: 0 });
        const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        const r = jsonObjects(text).filter((o) => o.id === x.id && typeof o.message === "string").pop();
        if (r) out.set(x.id, clean(r));
      } catch (e) {
        console.error(`AI analysis failed for lead ${x.id}:`, (e as Error).message);
      }
    }
  }));
  for (const x of items) {
    const fb = fallback(x, lang);
    const ai = out.get(x.id);
    out.set(x.id, ai ? { ...fb, ...Object.fromEntries(Object.entries(ai).filter(([, v]) => v !== undefined && v !== "")) } : fb);
  }
  return out;
}
