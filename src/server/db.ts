/** Neon serverless Postgres + schema bootstrap. */
import { neon } from "@neondatabase/serverless";

export const config = {
  apiKey: process.env.ANTHROPIC_API_KEY || "",
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  model: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
  adminToken: process.env.ADMIN_TOKEN || "",
  sender: process.env.SENDER_NAME || "Mohammad Adeeb",
  senderTitle: process.env.SENDER_TITLE || "AI Automation & Full-Stack Developer",
};

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const sql = neon(url);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS jobs (
     id SERIAL PRIMARY KEY, category TEXT NOT NULL, city TEXT NOT NULL, city_label TEXT NOT NULL DEFAULT '',
     lang TEXT NOT NULL DEFAULT 'en', status TEXT NOT NULL DEFAULT 'searching',
     total INT NOT NULL DEFAULT 0, processed INT NOT NULL DEFAULT 0, is_public BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS leads (
     id SERIAL PRIMARY KEY, job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     osm_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
     lat DOUBLE PRECISION, lon DOUBLE PRECISION,
     phone TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
     socials JSONB NOT NULL DEFAULT '{}', signals JSONB NOT NULL DEFAULT '{}', ai JSONB NOT NULL DEFAULT '{}',
     score INT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (job_id, osm_id))`,
  `CREATE INDEX IF NOT EXISTS leads_job_idx ON leads (job_id, status)`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bbox JSONB`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_results INT NOT NULL DEFAULT 25`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error TEXT NOT NULL DEFAULT ''`,
];

let ready: Promise<void> | null = null;
export function ensureDb(): Promise<void> {
  if (!url) return Promise.reject(new Error("DATABASE_URL is not configured"));
  ready ??= (async () => {
    for (const s of SCHEMA) await sql.query(s);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export type Lead = {
  id: number; job_id: number; osm_id: string; name: string; address: string; lat: number | null; lon: number | null;
  phone: string; website: string; email: string; socials: Record<string, string>; signals: Signals; ai: AiResult;
  score: number; status: "new" | "done";
};

export type Signals = {
  has_website?: boolean; reachable?: boolean; https?: boolean; mobile_friendly?: boolean; response_ms?: number;
  title?: string; description?: string; copyright_year?: number | null; has_chat?: boolean; has_booking?: boolean;
  tech?: string[]; robots_blocked?: boolean; error?: string;
};

export type AiResult = { summary?: string; opportunities?: string[]; services?: string[]; subject?: string; message?: string; priority?: string };
