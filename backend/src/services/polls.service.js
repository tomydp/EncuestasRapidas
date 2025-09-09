import db from "../db/migrate.js";

const insertPollStmt = db.prepare(`
  INSERT INTO polls (question, response_type, close_date_iso, created_at)
  VALUES (?, ?, ?, ?)
`);
const insertOptionStmt = db.prepare(`
  INSERT INTO options (poll_id, text, votes) VALUES (?, ?, 0)
`);
const listOptionsByPollStmt = db.prepare(`
  SELECT id, text, votes FROM options WHERE poll_id = ? ORDER BY id ASC
`);

const listPollsStmt = db.prepare(`
  SELECT id, question, response_type, close_date_iso, created_at
  FROM polls
  ORDER BY id DESC
`);

const sumVotesByPollStmt = db.prepare(`
  SELECT SUM(votes) AS total FROM options WHERE poll_id = ?
`);


export function createPoll(req, res) {
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
    return res.status(201).json({
      id: Number(newId),
      question,
      responseType,
      closeDateISO,
      options: opts
    });
  } catch {
    return res.status(400).json({ error: "No se pudo crear la encuesta (opciones duplicadas o datos inválidos)." });
  }
}

export function listPollsWithStats(_req, res) {
  const polls = listPollsStmt.all();
  const out = polls.map((p) => {
    const options = listOptionsByPollStmt.all(p.id);
    const sum = sumVotesByPollStmt.get(p.id)?.total || 0;
    return {
      id: p.id,
      question: p.question,
      responseType: p.response_type,
      closeDateISO: p.close_date_iso,
      createdAt: p.created_at,
      totalVotes: Number(sum),
      options
    };
  });
  res.json(out);
}

export function deletePoll(req, res) {
  const id = Number(req.params.id);
  const info = db.prepare(`DELETE FROM polls WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Encuesta no encontrada" });
  res.json({ ok: true });
}

export function closePoll(req, res) {
  const id = Number(req.params.id);
  const { closeDateISO } = req.body || {};
  // permitir cerrar ahora o fijar otra fecha (opcional)
  const newDate = closeDateISO || new Date().toISOString().slice(0,10);
  const info = db.prepare(`UPDATE polls SET close_date_iso = ? WHERE id = ?`).run(newDate, id);
  if (info.changes === 0) return res.status(404).json({ error: "Encuesta no encontrada" });

  const p = db.prepare(`SELECT id, question, response_type, close_date_iso, created_at FROM polls WHERE id = ?`).get(id);
  const options = listOptionsByPollStmt.all(id);
  res.json({
    id: p.id,
    question: p.question,
    responseType: p.response_type,
    closeDateISO: p.close_date_iso,
    createdAt: p.created_at,
    options
  });
}
