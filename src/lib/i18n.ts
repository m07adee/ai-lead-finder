"use client";
import { useEffect, useState } from "react";

export type Lang = "en" | "ar";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "ar", label: "العربية" },
];

const en = {
  brand: "AI Lead Finder",
  nav: { demo: "Live demo", app: "Open app", publicDemo: "Public demo", signOut: "Sign out", openApp: "Open the app →" },
  landing: {
    badge: "Lead generation · website audit · AI outreach",
    title: "Find local businesses that need you — and the words to reach them",
    sub: "Type “dentists in Kadıköy”. Get a scored list of real businesses, what is wrong with their online presence, and a personalized email for each one.",
    ctaDemo: "See a live demo →",
    ctaApp: "Open the app",
    steps: [
      { icon: "🗺️", title: "Find", text: "Pick a business type and a city. Local businesses are pulled from OpenStreetMap — open, legal data." },
      { icon: "🔍", title: "Audit", text: "Each website is checked politely (robots.txt respected): HTTPS, mobile, booking, live chat, speed, broken domains, public emails and socials." },
      { icon: "🎯", title: "Score", text: "A transparent 0–100 opportunity score shows who needs a website, booking system or AI chatbot the most." },
      { icon: "✍️", title: "Write", text: "AI drafts a short, personalized cold email for every lead in English, Arabic or Turkish, based on real findings." },
      { icon: "📊", title: "Export", text: "Download a styled Excel or CSV file ready for your CRM or Google Sheets." },
    ],
    footer: "Built by Mohammad Adeeb · AI Automation & Full-Stack Developer · Map data © OpenStreetMap contributors (ODbL)",
  },
  login: { sub: "Enter your access token to continue.", placeholder: "Access token", button: "Sign in", demo: "or view the public demo →", wrong: "Wrong access token" },
  form: {
    title: "New lead search", type: "Business type", city: "City or district", cityPh: "e.g. Kadıköy, Istanbul",
    emailLang: "Email language", max: "Max results", find: "🔎 Find leads", starting: "Starting…",
    note: "Data: OpenStreetMap (ODbL) + each business's own public website. Respects robots.txt.",
  },
  jobs: { title: "Searches", empty: "No searches yet." },
  empty: { title: "Pick a business type and a city", sub: "The AI finds local businesses, audits their websites and drafts a personalized email for each one." },
  job: {
    excel: "⬇ Excel", csv: "⬇ CSV", onDemo: "🌍 On demo", showDemo: "Show on demo", del: "Delete",
    confirmDel: "Delete this search and all its leads?", searching: "Searching OpenStreetMap…", busy: "Map servers are busy, retrying…",
    auditing: (p: number, t: number) => `Auditing websites & writing emails… ${p}/${t}`,
    keepOpen: "Keep this tab open — it processes 5 businesses at a time.", failed: "This search failed.",
    exportFail: "Export failed", demoOn: "This search now shows on /demo (contacts masked)", demoOff: "Removed from the public demo",
  },
  stats: { businesses: "Businesses", high: "High priority", email: "With email", ai: "AI emails" },
  table: {
    filters: { all: "All", high: "🔥 High priority", email: "✉️ Has email", nosite: "🌐 No / broken website" },
    search: "Search name or address…", none: "No leads match this filter.",
    email: "Email", phone: "Phone", website: "Website", address: "Address", map: "📍 Map", pitch: "Pitch",
    draft: "AI outreach draft", copySubject: "Copy subject", copyMessage: "Copy message", copied: "✓ Copied",
    noDraft: "No AI draft for this lead (the AI service was busy). Re-run the search to regenerate.",
    noSite: "no website listed", https: "🔒 HTTPS", noHttps: "⚠️ no HTTPS", mobile: "📱 mobile-ready", noMobile: "⚠️ not mobile",
    booking: "📅 booking", noBooking: "no booking", chat: "💬 chat", noChat: "no chat",
  },
  demo: {
    badge: "Live demo · real search results · contacts masked",
    title: (n: number, city: string) => `${n} leads found in ${city}`,
    sub: "Each business was found on OpenStreetMap, its website was audited automatically, and the AI drafted a personalized outreach email.",
    none: "No public demo search yet.",
  },
  categories: {} as Record<string, string>,
};

export type Dict = typeof en;

const ar: Dict = {
  brand: "AI Lead Finder",
  nav: { demo: "عرض تجريبي", app: "افتح الأداة", publicDemo: "العرض التجريبي", signOut: "تسجيل الخروج", openApp: "افتح الأداة ←" },
  landing: {
    badge: "جلب العملاء · فحص المواقع · رسائل بالذكاء الاصطناعي",
    title: "اعثر على الشركات المحلية التي تحتاجك — والكلمات المناسبة للوصول إليها",
    sub: "اكتب «أطباء أسنان في كاديكوي» واحصل على قائمة مقيّمة بشركات حقيقية، وما ينقص حضورها على الإنترنت، ورسالة مخصصة لكل واحدة منها.",
    ctaDemo: "← شاهد عرضاً حياً",
    ctaApp: "افتح الأداة",
    steps: [
      { icon: "🗺️", title: "ابحث", text: "اختر نوع النشاط والمدينة، فنجلب الشركات المحلية من OpenStreetMap — بيانات مفتوحة وقانونية." },
      { icon: "🔍", title: "افحص", text: "نفحص موقع كل شركة باحترام (مع الالتزام بـ robots.txt): HTTPS، التوافق مع الجوال، الحجز، الشات، السرعة، الدومينات المعطلة، الإيميلات والسوشيال." },
      { icon: "🎯", title: "قيّم", text: "تقييم واضح من 0 إلى 100 يوضح من يحتاج موقعاً أو نظام حجز أو شات بوت أكثر من غيره." },
      { icon: "✍️", title: "اكتب", text: "يكتب الذكاء الاصطناعي رسالة تواصل قصيرة ومخصصة لكل شركة بالعربية أو الإنجليزية أو التركية، مبنية على ما وجده فعلاً." },
      { icon: "📊", title: "صدّر", text: "حمّل ملف Excel منسّقاً أو CSV جاهزاً لنظام CRM أو Google Sheets." },
    ],
    footer: "من تطوير محمد أديب · مطوّر أتمتة بالذكاء الاصطناعي وتطبيقات متكاملة · بيانات الخرائط © مساهمو OpenStreetMap (ODbL)",
  },
  login: { sub: "أدخل رمز الدخول للمتابعة.", placeholder: "رمز الدخول", button: "دخول", demo: "← أو شاهد العرض التجريبي", wrong: "رمز الدخول غير صحيح" },
  form: {
    title: "بحث جديد عن عملاء", type: "نوع النشاط", city: "المدينة أو المنطقة", cityPh: "مثال: Kadıköy, Istanbul",
    emailLang: "لغة الرسائل", max: "أقصى عدد", find: "🔎 ابحث عن عملاء", starting: "جارٍ البدء…",
    note: "المصدر: OpenStreetMap (ODbL) + الموقع العام لكل شركة. مع الالتزام بـ robots.txt.",
  },
  jobs: { title: "عمليات البحث", empty: "لا توجد عمليات بحث بعد." },
  empty: { title: "اختر نوع النشاط والمدينة", sub: "يجد الذكاء الاصطناعي الشركات المحلية، ويفحص مواقعها، ويكتب رسالة مخصصة لكل واحدة." },
  job: {
    excel: "⬇ Excel", csv: "⬇ CSV", onDemo: "🌍 في العرض التجريبي", showDemo: "اعرض في العرض التجريبي", del: "حذف",
    confirmDel: "حذف هذا البحث وكل نتائجه؟", searching: "جارٍ البحث في OpenStreetMap…", busy: "خوادم الخرائط مشغولة، جارٍ إعادة المحاولة…",
    auditing: (p: number, t: number) => `جارٍ فحص المواقع وكتابة الرسائل… ${p}/${t}`,
    keepOpen: "أبقِ هذه الصفحة مفتوحة — تتم معالجة 5 شركات في كل مرة.", failed: "فشل هذا البحث.",
    exportFail: "فشل التصدير", demoOn: "هذا البحث يظهر الآن في /demo (مع إخفاء بيانات التواصل)", demoOff: "أُزيل من العرض التجريبي",
  },
  stats: { businesses: "الشركات", high: "أولوية عالية", email: "لديها إيميل", ai: "رسائل الذكاء الاصطناعي" },
  table: {
    filters: { all: "الكل", high: "🔥 أولوية عالية", email: "✉️ لديها إيميل", nosite: "🌐 بلا موقع / موقع معطل" },
    search: "ابحث بالاسم أو العنوان…", none: "لا توجد نتائج لهذا الفلتر.",
    email: "الإيميل", phone: "الهاتف", website: "الموقع", address: "العنوان", map: "📍 الخريطة", pitch: "الخدمات المقترحة",
    draft: "مسودة الرسالة بالذكاء الاصطناعي", copySubject: "نسخ العنوان", copyMessage: "نسخ الرسالة", copied: "✓ تم النسخ",
    noDraft: "لا توجد مسودة لهذه الشركة (كانت خدمة الذكاء الاصطناعي مشغولة). أعد البحث لإنشائها.",
    noSite: "لا يوجد موقع مسجل", https: "🔒 HTTPS", noHttps: "⚠️ بدون HTTPS", mobile: "📱 متوافق مع الجوال", noMobile: "⚠️ غير متوافق مع الجوال",
    booking: "📅 حجز", noBooking: "بدون حجز", chat: "💬 شات", noChat: "بدون شات",
  },
  demo: {
    badge: "عرض حي · نتائج بحث حقيقية · بيانات التواصل مخفية",
    title: (n: number, city: string) => `${n} عميل محتمل في ${city}`,
    sub: "وُجدت كل شركة على OpenStreetMap، وفُحص موقعها تلقائياً، وكتب الذكاء الاصطناعي رسالة تواصل مخصصة لها.",
    none: "لا يوجد بحث تجريبي عام بعد.",
  },
  categories: {
    dentist: "أطباء أسنان", clinic: "عيادات وأطباء", restaurant: "مطاعم", cafe: "مقاهٍ", gym: "نوادٍ رياضية",
    beauty: "صالونات تجميل", hairdresser: "حلاقون وصالونات شعر", hotel: "فنادق", real_estate: "مكاتب عقارات",
    lawyer: "مكاتب محاماة", accountant: "محاسبون", car_repair: "ورش سيارات", veterinary: "عيادات بيطرية", language_school: "مدارس لغات",
  },
};

export const T: Record<Lang, Dict> = { en, ar };

function store(k: string, v?: string) {
  try {
    if (v !== undefined) localStorage.setItem(k, v);
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** UI language: ?lang= → saved choice → browser language. Keeps <html lang/dir> in sync. */
export function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("lang");
    const nav = (navigator.language || "en").slice(0, 2);
    const pick = [q, store("lf-lang"), nav].find((x) => x && x in T) as Lang | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after hydration
    if (pick) setLang(pick);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    store("lf-lang", lang);
  }, [lang]);
  const t = T[lang];
  const cat = (id: string, fallback?: string) => t.categories[id] || fallback || id;
  return { lang, setLang, t, cat };
}
