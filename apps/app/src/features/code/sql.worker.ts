// Runs SQL pages on SQLite, compiled to WebAssembly. One database per page,
// in memory for as long as the app runs, so a table made in one run is there
// in the next. Each statement that returns rows gives one table.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type Sqlite = Awaited<ReturnType<typeof sqlite3InitModule>>;
type Db = InstanceType<Sqlite["oo1"]["DB"]>;

const ready: Promise<Sqlite> = sqlite3InitModule();
const dbs = new Map<string, Db>();

self.onmessage = async ({ data }: MessageEvent<{ page: string; code: string; reset?: boolean }>) => {
  const sqlite = await ready;
  self.postMessage({ kind: "started" });
  if (data.reset) {
    dbs.get(data.page)?.close();
    dbs.delete(data.page);
  }
  let db = dbs.get(data.page);
  if (!db) {
    db = new sqlite.oo1.DB(":memory:");
    dbs.set(data.page, db);
  }
  try {
    const tables: { stmt: unknown; columns: string[]; rows: unknown[][] }[] = [];
    const before = db.changes(true);
    db.exec(data.code, {
      rowMode: "stmt",
      callback: (stmt) => {
        let table = tables.at(-1);
        if (table?.stmt !== stmt) {
          table = { stmt, columns: stmt.getColumnNames(), rows: [] };
          tables.push(table);
        }
        table.rows.push(stmt.get([]));
      },
    });
    for (const { columns, rows } of tables) self.postMessage({ kind: "table", columns, rows });
    const changed = db.changes(true) - before;
    if (changed > 0) self.postMessage({ kind: "info", text: `${changed} ${changed === 1 ? "row" : "rows"} changed.` });
  } catch (error) {
    self.postMessage({ kind: "err", text: String(error instanceof Error ? error.message : error) });
  }
  self.postMessage({ kind: "done" });
};
