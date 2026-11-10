import { sql, type Lead } from "@/server/db";
import { handler, json, maskEmail, maskPhone } from "@/server/http";

/** Public read-only showcase of the job marked as public. Contact details are masked. */
export const GET = handler(async () => {
  const [job] = (await sql`SELECT id, category, city, city_label, lang, total, processed, status, created_at
                           FROM jobs WHERE is_public ORDER BY id DESC LIMIT 1`) as Record<string, unknown>[];
  if (!job) return json({ job: null, leads: [] });
  const leads = (await sql`SELECT * FROM leads WHERE job_id=${job.id as number} AND status='done' ORDER BY score DESC, name`) as Lead[];
  return json({
    job,
    leads: leads.map((l) => ({ ...l, email: maskEmail(l.email), phone: maskPhone(l.phone) })),
  });
});
