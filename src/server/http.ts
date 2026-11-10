/** Route-handler helpers: JSON errors, admin auth, DB bootstrap. */
import { timingSafeEqual } from "node:crypto";
import { config, ensureDb } from "./db";
import { UserError } from "./errors";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function requireAdmin(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(token);
  const b = Buffer.from(config.adminToken);
  if (!config.adminToken || a.length !== b.length || !timingSafeEqual(a, b)) throw new UserError("Invalid access token", 401);
}

export function handler<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A) => {
    try {
      await ensureDb();
      return await fn(req, ...args);
    } catch (e) {
      if (e instanceof UserError) return json({ detail: e.message }, e.status);
      console.error(e);
      return json({ detail: "Server error" }, 500);
    }
  };
}

/** Mask contact details for the public demo page (e.g. "i***@clinic.com", "+90 ••• •• 34"). */
export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 1)}***@${d}` : "";
}
export function maskPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return digits.length > 4 ? `${p.slice(0, 4)} ••• ${digits.slice(-2)}` : "";
}
