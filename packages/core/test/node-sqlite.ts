import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { SqlDatabase } from "../src";

const schema = readFileSync(new URL("../src/schema.sql", import.meta.url), "utf8");

/** An in-memory SQLite database that behaves like the Tauri SQL plugin's Database. */
export function memorySqlDatabase(): SqlDatabase {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  // The plugin uses $1, $2; Node's SQLite reads the same positions as ?1, ?2.
  const prepare = (sql: string) => db.prepare(sql.replace(/\$(\d+)/g, "?$1"));
  return {
    async execute(sql, params = []) {
      return prepare(sql).run(...(params as never[]));
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return prepare(sql).all(...(params as never[])) as T[];
    },
  };
}
