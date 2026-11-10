/** Business discovery from OpenStreetMap (open data, ODbL): Nominatim geocoding + Overpass search. */
import { UserError } from "./errors";

const UA = "AI-Lead-Finder/1.0 (+https://github.com/m07adee/ai-lead-finder)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

export const CATEGORIES: Record<string, { label: string; filters: string[] }> = {
  dentist: { label: "Dentists", filters: ['["amenity"="dentist"]'] },
  clinic: { label: "Clinics & doctors", filters: ['["amenity"="clinic"]', '["amenity"="doctors"]'] },
  restaurant: { label: "Restaurants", filters: ['["amenity"="restaurant"]'] },
  cafe: { label: "Cafés", filters: ['["amenity"="cafe"]'] },
  gym: { label: "Gyms & fitness", filters: ['["leisure"="fitness_centre"]'] },
  beauty: { label: "Beauty salons", filters: ['["shop"="beauty"]'] },
  hairdresser: { label: "Hairdressers & barbers", filters: ['["shop"="hairdresser"]'] },
  hotel: { label: "Hotels", filters: ['["tourism"="hotel"]'] },
  real_estate: { label: "Real estate agencies", filters: ['["office"="estate_agent"]'] },
  lawyer: { label: "Law firms", filters: ['["office"="lawyer"]'] },
  accountant: { label: "Accountants", filters: ['["office"="accountant"]'] },
  car_repair: { label: "Car repair shops", filters: ['["shop"="car_repair"]'] },
  veterinary: { label: "Veterinary clinics", filters: ['["amenity"="veterinary"]'] },
  language_school: { label: "Language schools", filters: ['["amenity"="language_school"]'] },
};

export type Place = {
  osm_id: string; name: string; address: string; lat: number | null; lon: number | null;
  phone: string; website: string; email: string; socials: Record<string, string>;
};

export async function geocode(city: string): Promise<{ label: string; bbox: [number, number, number, number] }> {
  const u = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: city, format: "json", limit: "1" })}`;
  const r = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new UserError(`Location lookup failed (${r.status})`, 502);
  const [hit] = (await r.json()) as { display_name: string; boundingbox: string[] }[];
  if (!hit) throw new UserError(`Could not find "${city}". Try "District, City" or "City, Country".`);
  const [s, n, w, e] = hit.boundingbox.map(Number);
  // keep searches local: cap very large areas (whole countries) to a ~40 km box around the center
  const cy = (s + n) / 2, cx = (w + e) / 2, maxSpan = 0.36;
  const box: [number, number, number, number] = n - s > maxSpan || e - w > maxSpan
    ? [cy - maxSpan / 2, cx - maxSpan / 2, cy + maxSpan / 2, cx + maxSpan / 2]
    : [s, w, n, e];
  return { label: hit.display_name.split(",").slice(0, 3).join(",").trim(), bbox: box };
}

const pick = (t: Record<string, string>, ...keys: string[]) => keys.map((k) => t[k]).find(Boolean) || "";

export async function searchPlaces(category: string, bbox: [number, number, number, number], limit: number): Promise<Place[]> {
  const cat = CATEGORIES[category];
  if (!cat) throw new UserError("Unknown category");
  const b = bbox.map((x) => x.toFixed(5)).join(",");
  const query = `[out:json][timeout:35];(${cat.filters.map((f) => `nwr${f}["name"](${b});`).join("")});out center tags 400;`;
  type OverpassResult = { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  // Race all public mirrors and keep the first good answer (each mirror is often busy); stay under serverless limits.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let data: OverpassResult | null = null;
  let lastErr = "";
  try {
    data = await Promise.any(OVERPASS.map(async (endpoint) => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as OverpassResult;
      if (!Array.isArray(body.elements)) throw new Error("bad response");
      return body;
    }));
  } catch (e) {
    lastErr = e instanceof AggregateError ? e.errors.map((x) => (x as Error).message).join(", ") : (e as Error).message;
  } finally {
    clearTimeout(timer);
    ctrl.abort(); // cancel the slower mirrors
  }
  if (!data) throw new UserError(`Map data service is busy (${lastErr}). Please try again in a minute.`, 503);

  const places = data.elements.map((el) => {
    const t = el.tags || {};
    const socials: Record<string, string> = {};
    for (const k of ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "whatsapp"]) {
      const v = pick(t, `contact:${k}`, k);
      if (v) socials[k] = v;
    }
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
    return {
      osm_id: `${el.type}/${el.id}`,
      name: t.name || "",
      address: [street, t["addr:district"] || t["addr:suburb"], t["addr:city"]].filter(Boolean).join(", "),
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      phone: pick(t, "phone", "contact:phone", "contact:mobile"),
      website: pick(t, "website", "contact:website", "url"),
      email: pick(t, "email", "contact:email"),
      socials,
    };
  });
  // websites first (richer leads), then the rest; de-duplicate by name
  const seen = new Set<string>();
  return places
    .filter((p) => p.name && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
    .sort((a, b) => Number(!!b.website) - Number(!!a.website))
    .slice(0, limit);
}
