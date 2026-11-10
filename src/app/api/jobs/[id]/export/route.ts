import ExcelJS from "exceljs";
import { sql, type Lead } from "@/server/db";
import { UserError } from "@/server/errors";
import { handler, requireAdmin } from "@/server/http";

const COLUMNS: [string, (l: Lead) => string | number][] = [
  ["Score", (l) => l.score],
  ["Priority", (l) => l.ai.priority || ""],
  ["Business", (l) => l.name],
  ["Email", (l) => l.email],
  ["Phone", (l) => l.phone],
  ["Website", (l) => l.website],
  ["Address", (l) => l.address],
  ["Opportunities", (l) => (l.ai.opportunities || []).join("; ")],
  ["Recommended services", (l) => (l.ai.services || []).join("; ")],
  ["Summary", (l) => l.ai.summary || ""],
  ["Email subject", (l) => l.ai.subject || ""],
  ["Outreach message", (l) => l.ai.message || ""],
  ["Instagram", (l) => l.socials.instagram || ""],
  ["Facebook", (l) => l.socials.facebook || ""],
  ["LinkedIn", (l) => l.socials.linkedin || ""],
  ["WhatsApp", (l) => l.socials.whatsapp || ""],
  ["Map", (l) => (l.lat && l.lon ? `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=18/${l.lat}/${l.lon}` : "")],
];

const csvCell = (v: string | number) => {
  const s = String(v ?? "");
  // neutralize spreadsheet formula injection and quote everything
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  requireAdmin(req);
  const id = Number((await ctx.params).id);
  const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const [job] = (await sql`SELECT * FROM jobs WHERE id=${id}`) as Record<string, string>[];
  if (!job) throw new UserError("Job not found", 404);
  const leads = (await sql`SELECT * FROM leads WHERE job_id=${id} AND status='done' ORDER BY score DESC, name`) as Lead[];
  const base = `leads-${job.category}-${job.city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");

  if (format === "csv") {
    const rows = [COLUMNS.map(([h]) => csvCell(h)).join(","), ...leads.map((l) => COLUMNS.map(([, f]) => csvCell(f(l))).join(","))];
    return new Response("﻿" + rows.join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "AI Lead Finder";
  const ws = wb.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map(([h]) => ({ header: h, width: h === "Outreach message" ? 70 : h === "Summary" ? 50 : h.length < 8 ? 10 : 24 }));
  for (const l of leads) ws.addRow(COLUMNS.map(([, f]) => f(l)));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  ws.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };
  ws.eachRow((row, n) => {
    if (n > 1) {
      row.alignment = { vertical: "top", wrapText: true };
      const score = Number(row.getCell(1).value);
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: score >= 60 ? "FFFECACA" : score >= 35 ? "FFFEF3C7" : "FFE5E7EB" } };
    }
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
});
