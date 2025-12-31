import { BunQL } from "@realastrox11/bunql";
import type { SQLQueryBindings } from "@realastrox11/bunql";

export const bunql = new BunQL({
  filename: "database.db",
  wal: true,
  create: true,
});

/**
 * Execute a raw SQL statement with parameters (for INSERT/UPDATE/DELETE)
 * Uses the underlying bun:sqlite database directly
 */
export function execWithParams(
  sql: string,
  params: SQLQueryBindings[] = [],
): void {
  const db = bunql.getDatabase();
  const stmt = db.prepare(sql);
  stmt.run(...params);
}

/**
 * Query with params and return results - wrapper around bunql.query
 */
export function queryWithParams<T>(
  sql: string,
  params: SQLQueryBindings[] = [],
): T[] {
  return bunql.query<T>(sql, params);
}
