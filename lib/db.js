import { Pool } from "pg";

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is not configured");
}

function normalizeConnectionString(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

function buildSslConfig(url) {
  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get("sslmode");
    if (sslmode === "require") {
      return {
        rejectUnauthorized: false,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const connectionString = normalizeConnectionString(rawConnectionString);
const ssl = buildSslConfig(rawConnectionString);

const globalForDb = globalThis;

export const pool =
  globalForDb.__truckAreaDbPool ||
  new Pool({
    connectionString,
    ssl,
  });

if (!globalForDb.__truckAreaDbPool) {
  globalForDb.__truckAreaDbPool = pool;
}

export async function query(text, params = []) {
  return pool.query(text, params);
}
