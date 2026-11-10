import { sql } from "@/server/db";
import { UserError } from "@/server/errors";
import { handler, json, requireAdmin } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };
const jobId = async (ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw new UserError("Invalid job id", 400);
  return id;
};

export const GET = handler(async (req: Request, ctx: Ctx) => {
  requireAdmin(req);
  const id = await jobId(ctx);
  const [job] = (await sql`SELECT * FROM jobs WHERE id=${id}`) as Record<string, unknown>[];
  if (!job) throw new UserError("Job not found", 404);
  const leads = await sql`SELECT * FROM leads WHERE job_id=${id} ORDER BY score DESC, (email <> '') DESC, name`;
  return json({ job, leads });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  requireAdmin(req);
  const id = await jobId(ctx);
  await sql`DELETE FROM jobs WHERE id=${id}`;
  return json({ ok: true });
});

/** PATCH { is_public } — choose which job the public /demo page shows (contacts are masked there). */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  requireAdmin(req);
  const id = await jobId(ctx);
  const { is_public } = await req.json().catch(() => ({}));
  if (is_public) await sql`UPDATE jobs SET is_public = (id = ${id})`;
  else await sql`UPDATE jobs SET is_public = false WHERE id=${id}`;
  return json({ ok: true });
});
