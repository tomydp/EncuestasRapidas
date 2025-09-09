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
