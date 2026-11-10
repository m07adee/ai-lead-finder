/**
 * Polite website analysis: respects robots.txt, one homepage + at most one contact page,
 * short timeouts, identifies itself. Extracts public business contact info and quality signals.
 */
import { parse } from "node-html-parser";
import type { Signals } from "./db";

const UA = "AI-Lead-Finder/1.0 (+https://github.com/m07adee/ai-lead-finder)";
const MAX_BYTES = 1_500_000;

const SOCIAL_HOSTS: Record<string, RegExp> = {
  instagram: /instagram\.com\/[^/?#"']+/i,
  facebook: /facebook\.com\/[^/?#"']+/i,
  linkedin: /linkedin\.com\/(company|in)\/[^/?#"']+/i,
  tiktok: /tiktok\.com\/@[^/?#"']+/i,
  youtube: /youtube\.com\/(@|channel\/|c\/)[^/?#"']+/i,
  twitter: /(twitter|x)\.com\/[^/?#"']+/i,
  whatsapp: /(wa\.me\/\d+|api\.whatsapp\.com\/send\?phone=\d+)/i,
};
const CHAT = /tawk\.to|intercom|crisp\.chat|tidio|livechatinc|zendesk|hs-scripts|drift\.com|chatra|jivosite|wa\.me|whatsapp/i;
const BOOKING = /calendly|booksy|setmore|simplybook|acuityscheduling|randevu|rezervasyon|book (an |your )?(appointment|online|now)|online booking|appointment|حجز موعد/i;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|example\.|sentry|wixpress|domain\.com|email\.com|yourname|@2x/i;

async function get(url: string, ms: number): Promise<{ ok: boolean; status: number; url: string; text: string; ms: number }> {
  const t = Date.now();
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
  const buf = await r.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf.slice(0, MAX_BYTES));
  return { ok: r.ok, status: r.status, url: r.url || url, text, ms: Date.now() - t };
}

/** Minimal robots.txt check for our bot / "*": is the given path disallowed? */
async function robotsAllows(origin: string, path: string): Promise<boolean> {
  try {
    const r = await get(`${origin}/robots.txt`, 4000);
    if (!r.ok) return true;
    let applies = false;
    const rules: string[] = [];
    for (const raw of r.text.split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*" || /ai-lead-finder/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v) rules.push(v);
    }
    return !rules.some((rule) => path.startsWith(rule));
  } catch {
    return true;
  }
}

function extract(html: string, base: string) {
  const root = parse(html);
  const links = root.querySelectorAll("a[href]").map((a) => a.getAttribute("href") || "");
  const text = root.text;
  const emails = new Set<string>();
  for (const l of links) if (/^mailto:/i.test(l)) emails.add(decodeURIComponent(l.slice(7).split("?")[0]).trim().toLowerCase());
  for (const m of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []) emails.add(m.toLowerCase());
  const socials: Record<string, string> = {};
  for (const l of links) for (const [k, re] of Object.entries(SOCIAL_HOSTS)) if (!socials[k] && re.test(l)) socials[k] = l.startsWith("http") ? l : `https://${l.replace(/^\/+/, "")}`;
  const phones = links.filter((l) => /^tel:/i.test(l)).map((l) => l.slice(4).trim());
  const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map((m) => Number(m[1]));
  const contactHref = links.find((l) => /contact|iletisim|iletişim|kontakt|contacto|اتصل|تواصل/i.test(l));
  let contactUrl = "";
  try {
    if (contactHref) {
      const u = new URL(contactHref, base);
      if (u.origin === new URL(base).origin) contactUrl = u.href;
    }
  } catch {}
  return {
    emails: [...emails].filter((e) => !BAD_EMAIL.test(e) && e.length < 80),
    socials,
    phone: phones[0] || "",
    signals: {
      title: (root.querySelector("title")?.text || "").trim().slice(0, 120),
      description: (root.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim().slice(0, 200),
      mobile_friendly: !!root.querySelector('meta[name="viewport"]'),
      copyright_year: years.length ? Math.max(...years) : null,
      has_chat: CHAT.test(html),
      has_booking: BOOKING.test(html),
      tech: [
        /wp-content|wordpress/i.test(html) && "WordPress",
        /wix\.com|wixstatic/i.test(html) && "Wix",
        /cdn\.shopify|shopify/i.test(html) && "Shopify",
        /squarespace/i.test(html) && "Squarespace",
        /webflow/i.test(html) && "Webflow",
        /__next|_next\/static/i.test(html) && "Next.js",
      ].filter(Boolean) as string[],
    },
    contactUrl,
  };
}

export async function enrichWebsite(website: string): Promise<{ email: string; phone: string; socials: Record<string, string>; signals: Signals }> {
  if (!website) return { email: "", phone: "", socials: {}, signals: { has_website: false } };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  } catch {
    return { email: "", phone: "", socials: {}, signals: { has_website: true, reachable: false, error: "invalid URL" } };
  }
  if (!(await robotsAllows(url.origin, url.pathname || "/"))) {
    return { email: "", phone: "", socials: {}, signals: { has_website: true, robots_blocked: true } };
  }
  try {
    const home = await get(url.href, 9000);
    if (!home.ok) return { email: "", phone: "", socials: {}, signals: { has_website: true, reachable: false, error: `HTTP ${home.status}` } };
    const data = extract(home.text, home.url);
    let emails = data.emails;
    if (!emails.length && data.contactUrl && (await robotsAllows(url.origin, new URL(data.contactUrl).pathname))) {
      try {
        const c = await get(data.contactUrl, 7000);
        if (c.ok) {
          const more = extract(c.text, c.url);
          emails = more.emails;
          Object.assign(data.socials, Object.fromEntries(Object.entries(more.socials).filter(([k]) => !data.socials[k])));
          data.phone ||= more.phone;
        }
      } catch {}
    }
    // prefer an email on the business's own domain
    const host = new URL(home.url).hostname.replace(/^www\./, "");
    emails.sort((a, b) => Number(b.endsWith(host)) - Number(a.endsWith(host)));
    return {
      email: emails[0] || "",
      phone: data.phone,
      socials: data.socials,
      signals: { has_website: true, reachable: true, https: home.url.startsWith("https://"), response_ms: home.ms, ...data.signals },
    };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    const code = String(err.cause?.code || "");
    const reason = err.name === "TimeoutError" ? "timeout" : /CERT|SSL|TLS/i.test(code) ? "ssl_error" : /ENOTFOUND|EAI_AGAIN/.test(code) ? "domain_not_found" : "unreachable";
    return { email: "", phone: "", socials: {}, signals: { has_website: true, reachable: false, error: reason } };
  }
}

/** Transparent, rule-based opportunity score (0-100): how much this business could gain from digital services. */
export function opportunityScore(s: Signals, hasPhoneOrEmail: boolean, socialCount: number): number {
  let score = 0;
  if (!s.has_website) score += 50;
  else if (s.reachable === false) score += 40;
  else if (!s.robots_blocked) {
    if (!s.https) score += 10;
    if (!s.mobile_friendly) score += 15;
    if (s.copyright_year && s.copyright_year <= new Date().getFullYear() - 3) score += 10;
    if (!s.has_chat) score += 12;
    if (!s.has_booking) score += 12;
    if ((s.response_ms || 0) > 3000) score += 6;
  }
  if (socialCount === 0) score += 5;
  if (!hasPhoneOrEmail) score -= 15; // hard to contact
  return Math.max(0, Math.min(100, score));
}
