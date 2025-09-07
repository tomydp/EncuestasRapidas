// @ts-nocheck
// MOCK API: intercepta fetch para rutas /api/* — 100% frontend
(() => {
    const USE_MOCK = true;
    if (!USE_MOCK) return;
  
    const realFetch = window.fetch.bind(window);
    const LS_KEY = "__polls_mockdb__";
  
    function loadDB() {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || ""); }
      catch { return null; }
    }
    function saveDB(db) { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
  
    // Estado inicial
    let db = loadDB() || { users: [], polls: [], nextPollId: 1, nextOptId: 1 };
  
    // Seed admin si no existe
    if (!db.users.some(u => u.role === "admin")) {
      db.users.push({ id: 1, name: "Admin", email: "admin@demo.com", pass: "Admin123", role: "admin" });
      saveDB(db);
    }
  
    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    }
    function parseBody(init) {
      try { return init && init.body ? JSON.parse(init.body) : {}; }
      catch { return {}; }
    }
    function makeToken(user) { return `mock.${btoa(user.email)}.${Date.now()}`; }
    function getUserByToken(h) {
      const auth = (h && (h.Authorization || h.authorization)) || "";
      const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
      if (!token) return null;
      const parts = token.split(".");
      if (parts[0] !== "mock") return null;
      const email = atob(parts[1] || "").toLowerCase();
      return db.users.find(u => u.email.toLowerCase() === email) || null;
    }
    function isClosed(iso) { return new Date() > new Date(iso + "T23:59:59"); }
  
    // Interceptor
    window.fetch = async function (input, init = {}) {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();
  
      // Solo interceptamos rutas /api/*
      if (!/\/api\//.test(url)) return realFetch(input, init);
  
      const u = new URL(url, location.origin);
      const path = u.pathname;
      const headers = init.headers || {};
  
      // ---------- AUTH ----------
      if (path === "/api/auth/register" && method === "POST") {
        const { name, email, password } = parseBody(init);
        if (!name || !email || !password) return json({ error: "Datos inválidos" }, 400);
        const exists = db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase());
        if (exists) return json({ error: "El email ya está registrado." }, 400);
        const id = (Math.max(0, ...db.users.map(u => u.id || 0)) + 1) || 1;
        db.users.push({ id, name: String(name), email: String(email).toLowerCase(), pass: String(password), role: "user" });
        saveDB(db);
        return json({ ok: true }, 201);
      }
  
      if (path === "/api/auth/login" && method === "POST") {
        const { email, password } = parseBody(init);
        const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
        if (!user || user.pass !== String(password)) return json({ error: "Credenciales inválidas" }, 400);
        const token = makeToken(user);
        return json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      }
  
      if (path === "/api/admin/me" && method === "GET") {
        const me = getUserByToken(headers);
        if (!me) return json({ error: "No autenticado" }, 401);
        return json({ user: { id: me.id, name: me.name, email: me.email, role: me.role } });
      }
  
      // ---------- ADMIN: crear encuesta ----------
      if (path === "/api/admin/polls" && method === "POST") {
        const me = getUserByToken(headers);
        if (!me || me.role !== "admin") return json({ error: "No autorizado" }, 401);
  
        const { question, responseType, closeDate, options } = parseBody(init);
  
        // Validaciones simples
        const q = String(question || "").trim();
        if (q.length < 10 || q.length > 140) return json({ error: "Pregunta inválida (10–140, sin HTML)." }, 400);
        if (!["single", "multiple"].includes(responseType)) return json({ error: "Tipo de respuesta inválido." }, 400);
        if (!closeDate) return json({ error: "La fecha debe ser futura." }, 400);
  
        const lines = Array.isArray(options) ? [...new Set(options.filter(Boolean))] : [];
        if (lines.length < 2 || lines.length > 10) return json({ error: "Debe haber entre 2 y 10 opciones." }, 400);
  
        const id = db.nextPollId || 1;
        db.nextPollId = id + 1;
        const poll = {
          id,
          question: q,
          responseType,
          closeDateISO: closeDate,
          createdAt: new Date().toISOString(),
          options: []
        };
        let nextOptId = db.nextOptId || 1;
        lines.forEach(text => poll.options.push({ id: nextOptId++, text: String(text), votes: 0 }));
        db.nextOptId = nextOptId;
  
        db.polls.unshift(poll);
        saveDB(db);
        return json({ id: poll.id, question: poll.question, responseType: poll.responseType, closeDateISO: poll.closeDateISO, options: poll.options }, 201);
      }
  
      // ---------- Público: listar ----------
      if (path === "/api/polls" && method === "GET") {
        const q = (u.searchParams.get("q") || "").toLowerCase();
        const out = db.polls
          .filter(p => !q || p.question.toLowerCase().includes(q))
          .map(p => ({ ...p, options: p.options.map(o => ({ id: o.id, text: o.text, votes: o.votes })) }));
        return json(out);
      }
  
      // ---------- Público: votar ----------
      const voteMatch = path.match(/^\/api\/polls\/(\d+)\/vote$/);
      if (voteMatch && method === "POST") {
        const pollId = Number(voteMatch[1]);
        const poll = db.polls.find(p => p.id === pollId);
        if (!poll) return json({ error: "Encuesta no encontrada." }, 404);
        if (isClosed(poll.closeDateISO)) return json({ error: "Encuesta cerrada." }, 400);
  
        const body = parseBody(init);
        if (poll.responseType === "single") {
          const text = String(body.option || "");
          const opt = poll.options.find(o => o.text === text);
          if (!opt) return json({ error: "Opción inválida." }, 400);
          opt.votes++;
        } else {
          const arr = Array.isArray(body.options) ? body.options : [];
          const uniq = [...new Set(arr)];
          if (!uniq.length) return json({ error: "Sin opciones para votar." }, 400);
          for (const text of uniq) {
            if (!poll.options.some(o => o.text === text)) return json({ error: "Alguna opción no existe." }, 400);
          }
          uniq.forEach(text => { poll.options.find(o => o.text === text).votes++; });
        }
        saveDB(db);
        return json({ id: poll.id, results: poll.options.map(o => ({ id: o.id, text: o.text, votes: o.votes })) });
      }
  
      // Si no matchea, dejar pasar a la red real
      return realFetch(input, init);
    };
  })();
  