import postgres from 'postgres';
import { config } from '../config';

/**
 * Lazily-created database connection.
 *
 * Returns `null` whenever `DATABASE_URL` is unset, and every caller is required
 * to handle that. This is what lets the product ship and run correctly with no
 * database at all — history and alerts simply stay dormant.
 */

type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;
let attempted = false;

export function db(): Sql | null {
  if (attempted) return client;
  attempted = true;

  const url = config.database.url;
  if (!url) return null;

  try {
    client = postgres(url, {
      // Serverless functions get many short-lived instances, so a large pool
      // per instance would exhaust a free-tier connection limit immediately.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      // Neon and Supabase both require TLS.
      ssl: url.includes('localhost') ? false : 'require',
      onnotice: () => {},
    });
    return client;
  } catch {
    client = null;
    return null;
  }
}

/**
 * Run a query, returning `fallback` if there is no database or the query fails.
 *
 * Analytics are a nice-to-have layered on a life-safety utility. A database
 * outage must degrade the trends page, never the wait-time board.
 */
export async function safeQuery<T>(
  run: (sql: Sql) => Promise<T>,
  fallback: T,
): Promise<T> {
  const sql = db();
  if (!sql) return fallback;
  try {
    return await run(sql);
  } catch {
    return fallback;
  }
}
