import { questionRe, optionLineRe, validResponseTypes } from "../utils/regex.js";
import { sanitize } from "../utils/xss.js";

const isFutureISODate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return d.getTime() > today.getTime();
};

export function validateCreatePoll(req, res, next) {
  const b = req.body ?? {};
  const question = sanitize(b.question);
  const responseType = sanitize(b.responseType);
  const closeDate = sanitize(b.closeDate);

  if (!questionRe.test(question)) return res.status(400).json({ error: "Pregunta inválida (10–140, sin HTML)." });
  if (!validResponseTypes.has(responseType)) return res.status(400).json({ error: "Tipo de respuesta inválido." });
  if (!isFutureISODate(closeDate)) return res.status(400).json({ error: "La fecha debe ser futura." });

  const rawOptions = Array.isArray(b.options) ? b.options : [];
  const options = [...new Set(rawOptions.map(sanitize).filter(Boolean))];
  if (options.length < 2 || options.length > 10) return res.status(400).json({ error: "Debe haber entre 2 y 10 opciones." });
  for (const opt of options) if (!optionLineRe.test(opt)) return res.status(400).json({ error: `Opción inválida: ${opt}` });

  req.validPoll = { question, responseType, closeDateISO: closeDate, options };
  next();
}
