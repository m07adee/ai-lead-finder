import { analyzeBatch, type AiInput } from "@/server/ai";
import { sql, type Lead } from "@/server/db";
import { enrichWebsite, opportunityScore } from "@/server/enrich";
import { UserError } from "@/server/errors";
import { handler, json, requireAdmin } from "@/server/http";
import { CATEGORIES, searchPlaces } from "@/server/osm";

export const maxDuration = 60;
const BATCH = 5;

/**
 * Process the next batch of pending leads: analyze websites in parallel, score, then one AI call for
 * summaries + outreach drafts. The UI calls this repeatedly, so each request stays well under the time limit.
 */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  requireAdmin(req);
  const id = Number((await ctx.params).id);
  const [job] = (await sql`SELECT * FROM jobs WHERE id=${id}`) as Record<string, string>[];
  if (!job) throw new UserError("Job not found", 404);

  if (job.status === "failed") return json({ job, done: true });
  if (job.status === "searching") {
    // Phase 1: find businesses on OpenStreetMap. Public map servers are sometimes busy, so retry across calls.
    const attempts = Number(job.attempts) + 1;
    try {
      const places = await searchPlaces(job.category, job.bbox as unknown as [number, number, number, number], Number(job.max_results));
      if (!places.length) {
        const [failed] = (await sql`UPDATE jobs SET status='failed', attempts=${attempts},
          error=${`No ${CATEGORIES[job.category]?.label.toLowerCase() || "businesses"} found in this area. Try a bigger area.`}
          WHERE id=${id} RETURNING *`) as Record<string, unknown>[];
        return json({ job: failed, done: true });
      }
      await sql.query(
        `INSERT INTO leads (job_id, osm_id, name, address, lat, lon, phone, website, email, socials)
         SELECT $1, x.osm_id, x.name, x.address, x.lat, x.lon, x.phone, x.website, x.email, x.socials
         FROM jsonb_to_recordset($2::jsonb) AS x(osm_id text, name text, address text, lat float8, lon float8,
                                                  phone text, website text, email text, socials jsonb)
         ON CONFLICT DO NOTHING`,
        [id, JSON.stringify(places)],
      );
      const [updated] = (await sql`UPDATE jobs SET status='running', total=${places.length}, attempts=${attempts}, error=''
                                   WHERE id=${id} RETURNING *`) as Record<string, unknown>[];
      return json({ job: updated, done: false });
    } catch (e) {
      if (!(e instanceof UserError) || e.status !== 503) throw e;
      const giveUp = attempts >= 6;
      const [updated] = (await sql`UPDATE jobs SET attempts=${attempts}, status=${giveUp ? "failed" : "searching"},
        error=${giveUp ? "Map servers are overloaded right now. Please try again later." : "Map servers are busy, retrying…"}
        WHERE id=${id} RETURNING *`) as Record<string, unknown>[];
      return json({ job: updated, done: giveUp, retry_in: 6 });
    }
  }

  const batch = (await sql`SELECT * FROM leads WHERE job_id=${id} AND status='new' ORDER BY id LIMIT ${BATCH}`) as Lead[];
  if (batch.length) {
    const enriched = await Promise.all(batch.map(async (l) => {
      const r = await enrichWebsite(l.website);
      const socials = { ...l.socials, ...r.socials };
      const email = l.email || r.email;
      const phone = l.phone || r.phone;
      const score = opportunityScore(r.signals, !!(email || phone), Object.keys(socials).length);
      return { ...l, email, phone, socials, signals: r.signals, score };
    }));

    const ai = await analyzeBatch(
      enriched.map<AiInput>((l) => ({
        id: l.id, name: l.name, category: CATEGORIES[job.category]?.label || job.category, city: job.city_label || job.city,
        website: l.website, score: l.score, signals: l.signals, socials: Object.keys(l.socials),
      })),
      job.lang,
    );

    for (const l of enriched) {
      await sql`UPDATE leads SET email=${l.email}, phone=${l.phone}, socials=${JSON.stringify(l.socials)},
                signals=${JSON.stringify(l.signals)}, ai=${JSON.stringify(ai.get(l.id) || {})}, score=${l.score}, status='done'
                WHERE id=${l.id}`;
    }
  }

  const [{ remaining }] = (await sql`SELECT count(*)::int AS remaining FROM leads WHERE job_id=${id} AND status='new'`) as { remaining: number }[];
  const [updated] = (await sql`UPDATE jobs SET processed = total - ${remaining}, status = ${remaining ? "running" : "done"}
                               WHERE id=${id} RETURNING *`) as Record<string, unknown>[];
  return json({ job: updated, done: remaining === 0 });
});
