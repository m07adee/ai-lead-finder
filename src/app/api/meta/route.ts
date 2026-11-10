import { handler, json, requireAdmin } from "@/server/http";
import { CATEGORIES } from "@/server/osm";

/** Categories for the search form; with a valid token also confirms login. */
export const GET = handler(async (req: Request) => {
  const authed = (() => {
    try {
      requireAdmin(req);
      return true;
    } catch {
      return false;
    }
  })();
  if (req.headers.get("authorization") && !authed) return json({ detail: "Invalid access token" }, 401);
  return json({ categories: Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label })), authed });
});
