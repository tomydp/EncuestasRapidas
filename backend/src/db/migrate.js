// src/db/migrate.js
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// carpeta data al lado de package.json: backend/data
const dbDir = path.resolve(__dirname, "..", "..", "data");
fs.mkdirSync(dbDir, { recursive: true });

// ruta absoluta al archivo
const dbPath = path.join(dbDir, "data.db");

// Log (útil para verificar que apunta a donde toca)
console.log("[sqlite] dbPath =", dbPath);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    response_type TEXT NOT NULL CHECK (response_type IN ('single','multiple')),
    close_date_iso TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    votes INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    UNIQUE (poll_id, text)
  );
`);

export default db;
