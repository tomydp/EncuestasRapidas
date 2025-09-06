import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import xss from "xss";
import dotenv from "dotenv";
import Database from "better-sqlite3";
dotenv.config();

// ===== Config =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500";
const PORT = process.env.PORT || 3000;

// ===== DB: SQLite =====
const db = new Database("./data.db");
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

// ===== App =====
const app = express();
app.use(helmet());
app.use(express.json({ limit: "64kb" }));
app.use(cors({ origin: [FRONTEND_ORIGIN, "http://localhost:5500"] }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

// ===== Reglas (equivalentes al frontend) =====
const questionRe = /^[\p{L}\p{N}\s.,;:?!¡¿'"()-]{10,140}$/u;
const optionLineRe = /^[^<>]{1,50}$/; // no permite < >
const validResponseTypes = new Set(["single", "multiple"]);

const sanitize = (s) =>
  xss(String(s ?? "").trim(), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script", "style"] });

const isFutureISODate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
};

// ===== Middleware de validación =====
function validateCreatePoll(req, res, next) {
  const body = req.body ?? {};
  const question = sanitize(body.question);
  const responseType = sanitize(body.responseType);
  const closeDate = sanitize(body.closeDate);

  if (!questionRe.test(question)) {
    return res.status(400).json({ error: "Pregunta inválida (10–140, sin HTML)." });
  }
  if (!validResponseTypes.has(responseType)) {
    return res.status(400).json({ error: "Tipo de respuesta inválido." });
  }
  if (!isFutureISODate(closeDate)) {
    return res.status(400).json({ error: "La fecha debe ser futura." });
  }

  const rawOptions = Array.isArray(body.options) ? body.options : [];
  const options = [...new Set(rawOptions.map(sanitize).filter(Boolean))];
  if (options.length < 2 || options.length > 10) {
    return res.status(400).json({ error: "Debe haber entre 2 y 10 opciones." });
  }
  for (const opt of options) {
    if (!optionLineRe.test(opt)) {
      return res.status(400).json({ error: `Opción inválida: ${opt}` });
    }
  }

  req.validPoll = { question, responseType, closeDateISO: closeDate, options };
  next();
}

// ===== SQL preparados =====
const insertPollStmt = db.prepare(`
  INSERT INTO polls (question, response_type, close_date_iso, created_at)
  VALUES (?, ?, ?, ?)
`);
const insertOptionStmt = db.prepare(`
  INSERT INTO options (poll_id, text, votes)
  VALUES (?, ?, 0)
`);
const getPollByIdStmt = db.prepare(`SELECT * FROM polls WHERE id = ?`);
const listPollsStmt = db.prepare(`
  SELECT * FROM polls
  WHERE (@q IS NULL OR LOWER(question) LIKE '%' || @q || '%')
  ORDER BY id DESC
`);
const listOptionsByPollStmt = db.prepare(`
  SELECT id, text, votes FROM options WHERE poll_id = ? ORDER BY id ASC
`);
const incVoteSingleStmt = db.prepare(`
  UPDATE options SET votes = votes + 1 WHERE poll_id = ? AND text = ?
`);
const isClosed = (closeDateISO) => {
  const now = new Date();
  const closes = new Date(closeDateISO + "T23:59:59");
  return now > closes;
};

// ===== Rutas =====

// Crear encuesta (transacción para insertar poll + options)
app.post("/api/polls", validateCreatePoll, (req, res) => {
  const { question, responseType, closeDateISO, options } = req.validPoll;

  try {
    const tx = db.transaction(() => {
      const createdAt = new Date().toISOString();
      const info = insertPollStmt.run(question, responseType, closeDateISO, createdAt);
      const pollId = info.lastInsertRowid;
      for (const opt of options) insertOptionStmt.run(pollId, opt);
      return pollId;
    });
    const newId = tx();

    const opts = listOptionsByPollStmt.all(newId);
    res.status(201).json({
      id: Number(newId),
      question,
      responseType,
      closeDateISO,
      options: opts
    });
  } catch (err) {
    // Violación de UNIQUE(poll_id, text) u otros
    return res.status(400).json({ error: "No se pudo crear la encuesta (opciones duplicadas o datos inválidos)." });
  }
});

// Listar / buscar encuestas (con JOIN manual para opciones)
app.get("/api/polls", (req, res) => {
  const q = sanitize(req.query.q ?? "");
  const qParam = q ? q.toLowerCase() : null;

  const polls = listPollsStmt.all({ q: qParam });
  const out = polls.map((p) => ({
    id: p.id,
    question: p.question,
    responseType: p.response_type,
    closeDateISO: p.close_date_iso,
    createdAt: p.created_at,
    options: listOptionsByPollStmt.all(p.id)
  }));
  res.json(out);
});

// Votar
app.post("/api/polls/:id/vote", (req, res) => {
  const id = Number(req.params.id);
  const poll = getPollByIdStmt.get(id);
  if (!poll) return res.status(404).json({ error: "Encuesta no encontrada." });

  if (isClosed(poll.close_date_iso)) {
    return res.status(400).json({ error: "Encuesta cerrada." });
  }

  const body = req.body ?? {};
  if (poll.response_type === "single") {
    const opt = sanitize(body.option);
    if (!opt) return res.status(400).json({ error: "Opción requerida." });
    const info = incVoteSingleStmt.run(id, opt);
    if (info.changes === 0) return res.status(400).json({ error: "Opción inválida." });
  } else {
    const arr = Array.isArray(body.options) ? body.options : [];
    const clean = [...new Set(arr.map(sanitize).filter(Boolean))];
    if (clean.length === 0) return res.status(400).json({ error: "Sin opciones para votar." });

    const tx = db.transaction(() => {
      let updated = 0;
      for (const c of clean) {
        const info = incVoteSingleStmt.run(id, c);
        updated += info.changes;
      }
      return updated;
    });
    const changed = tx();
    if (changed !== clean.length) {
      return res.status(400).json({ error: "Alguna opción no existe en la encuesta." });
    }
  }

  const options = listOptionsByPollStmt.all(id);
  res.json({ id, results: options });
});

// ===== Arranque =====
app.listen(PORT, () => {
  console.log(`API de encuestas (SQLite) en http://localhost:${PORT}`);
  console.log(`CORS permitido desde: ${FRONTEND_ORIGIN}`);
});
