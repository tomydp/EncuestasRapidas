import { Router } from "express";
import db from "../db/index.js";
import { validateCreatePoll } from "../middleware/validate.js";
import { sanitize } from "../utils/xss.js";

const router = Router();

// prepared statements
const insertPoll = db.prepare(`INSERT INTO polls (question, response_type, close_date_iso, created_at) VALUES (?, ?, ?, ?)`);
const insertOption = db.prepare(`INSERT INTO options (poll_id, text, votes) VALUES (?, ?, 0)`);
const getPoll = db.prepare(`SELECT * FROM polls WHERE id = ?`);
const listPolls = db.prepare(`SELECT * FROM polls WHERE (@q IS NULL OR LOWER(question) LIKE '%' || @q || '%') ORDER BY id DESC`);
const listOptions = db.prepare(`SELECT id, text, votes FROM options WHERE poll_id = ? ORDER BY id ASC`);
const incVote = db.prepare(`UPDATE options SET votes = votes + 1 WHERE poll_id = ? AND text = ?`);

const isClosed = (iso) => new Date() > new Date(iso + "T23:59:59");

// crear
router.post("/", validateCreatePoll, (req, res) => {
  const { question, responseType, closeDateISO, options } = req.validPoll;
  try {
    const tx = db.transaction(() => {
      const info = insertPoll.run(question, responseType, closeDateISO, new Date().toISOString());
      const pollId = info.lastInsertRowid;
      for (const opt of options) insertOption.run(pollId, opt);
      return pollId;
    });
    const id = tx();
    res.status(201).json({ id: Number(id), question, responseType, closeDateISO, options: listOptions.all(id) });
  } catch {
    res.status(400).json({ error: "No se pudo crear (opciones duplicadas o datos inválidos)." });
  }
});

// listar/buscar
router.get("/", (req, res) => {
  const q = sanitize(req.query.q ?? "");
  const qParam = q ? q.toLowerCase() : null;
  const polls = listPolls.all({ q: qParam }).map(p => ({
    id: p.id,
    question: p.question,
    responseType: p.response_type,
    closeDateISO: p.close_date_iso,
    createdAt: p.created_at,
    options: listOptions.all(p.id)
  }));
  res.json(polls);
});

// votar
router.post("/:id/vote", (req, res) => {
  const id = Number(req.params.id);
  const poll = getPoll.get(id);
  if (!poll) return res.status(404).json({ error: "Encuesta no encontrada." });
  if (isClosed(poll.close_date_iso)) return res.status(400).json({ error: "Encuesta cerrada." });

  const body = req.body ?? {};
  if (poll.response_type === "single") {
    const opt = sanitize(body.option);
    if (!opt) return res.status(400).json({ error: "Opción requerida." });
    const info = incVote.run(id, opt);
    if (info.changes === 0) return res.status(400).json({ error: "Opción inválida." });
  } else {
    const arr = Array.isArray(body.options) ? body.options : [];
    const clean = [...new Set(arr.map(sanitize).filter(Boolean))];
    if (!clean.length) return res.status(400).json({ error: "Sin opciones para votar." });
    const tx = db.transaction(() => {
      let updated = 0;
      for (const c of clean) updated += incVote.run(id, c).changes;
      return updated;
    });
    const changed = tx();
    if (changed !== clean.length) return res.status(400).json({ error: "Alguna opción no existe en la encuesta." });
  }
  res.json({ id, results: listOptions.all(id) });
});

export default router;
