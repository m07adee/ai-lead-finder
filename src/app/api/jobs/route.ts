import { sql } from "@/server/db";
import { UserError } from "@/server/errors";
import { handler, json, requireAdmin } from "@/server/http";
import { CATEGORIES, geocode } from "@/server/osm";

export const maxDuration = 60;

export const GET = handler(async (req: Request) => {
  requireAdmin(req);
  return json(await sql`SELECT j.*, (SELECT count(*)::int FROM leads l WHERE l.job_id=j.id AND l.score>=60) AS hot
                        FROM jobs j ORDER BY j.id DESC LIMIT 50`);
});

/** Create a search job: geocode the area, find businesses on OpenStreetMap, store them as pending leads. */
export const POST = handler(async (req: Request) => {
  requireAdmin(req);
  const b = await req.json().catch(() => ({}));
  const category = String(b.category || "");
  const city = String(b.city || "").trim().slice(0, 120);
  const lang = ["en", "ar", "tr"].includes(b.lang) ? b.lang : "en";
  const limit = Math.max(5, Math.min(Number(b.limit) || 25, 60));
  if (!CATEGORIES[category]) throw new UserError("Choose a business type");
  if (city.length < 2) throw new UserError("Enter a city or district");

  // Fast part only: resolve the area. The (sometimes slow) map search runs in /step with automatic retries.
  const area = await geocode(city);
  const [job] = (await sql`INSERT INTO jobs (category, city, city_label, lang, bbox, max_results, status)
                           VALUES (${category}, ${city}, ${area.label}, ${lang}, ${JSON.stringify(area.bbox)}, ${limit}, 'searching') RETURNING *`) as Record<string, unknown>[];
  return json(job, 201);
});
