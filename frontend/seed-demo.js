// @ts-nocheck
(() => {
  const KEY = "__polls_mockdb__";
  const FORCE = true; // ← poné false cuando no quieras pisar datos

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { db = null; }
  if (!db || typeof db !== "object") db = {};
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.polls)) db.polls = [];
  if (typeof db.nextPollId !== "number") db.nextPollId = 1;
  if (typeof db.nextOptId  !== "number") db.nextOptId  = 1;

  if (!FORCE && db.polls.length > 0) return; // respeta datos existentes

  if (FORCE) {          // ← reinicia la “db”
    db.polls = [];
    db.nextPollId = 1;
    db.nextOptId  = 1;
  }

  const dateISO = d => d.toISOString().slice(0,10);
  const plusDays = n => { const t = new Date(); t.setDate(t.getDate()+n); return dateISO(t); };

  function mk(question, type, closeInDays, opts){
    const poll = {
      id: db.nextPollId++,
      question,
      responseType: type,
      closeDateISO: plusDays(closeInDays),
      createdAt: new Date().toISOString(),
      options: []
    };
    for (const text of opts) poll.options.push({ id: db.nextOptId++, text, votes: 0 });
    for (const o of poll.options) o.votes = Math.floor(Math.random()*12);
    return poll;
  }

  const seed = [
    mk("¿Cuál es tu lenguaje favorito para backend?", "single",   5, ["Node.js","Python","Java","Go"]),
    mk("¿Qué features querés para la app?",          "multiple",  3, ["Modo oscuro","Tiempo real","Compartir enlaces","Exportar CSV"]),
    mk("¿Qué día preferís para deploy?",             "single",    1, ["Lunes","Miércoles","Viernes"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),
    mk("¿Qué día preferís para fasdfsdfd?",             "single",    1, ["fdas","fdsa","fff"]),

  ];

  db.polls.unshift(...seed);
  localStorage.setItem(KEY, JSON.stringify(db));
})();
