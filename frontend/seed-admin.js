// @ts-nocheck
// Crea/actualiza un admin de demo en la "DB" del mock (localStorage).
(() => {
    const KEY = "__polls_mockdb__";
    const ADMIN = {
      name: "Admin",
      email: "admin@demo.com",
      // Fuerte: mayúscula, minúscula, número y >= 8 chars
      password: "Admin1234",
      role: "admin",
    };
  
    let db;
    try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { db = null; }
    if (!db || typeof db !== "object") db = {};
    if (!Array.isArray(db.users)) db.users = [];
    if (typeof db.nextUserId !== "number") db.nextUserId = 1;
  
    const idx = db.users.findIndex(u => (u.email || "").toLowerCase() === ADMIN.email.toLowerCase());
    if (idx >= 0) {
      // upsert
      db.users[idx].name = ADMIN.name;
      db.users[idx].role = "admin";
      db.users[idx].password = ADMIN.password; // aseguro pass fuerte
      console.log("[seed-admin] Admin actualizado:", ADMIN.email);
    } else {
      db.users.push({
        id: db.nextUserId++,
        name: ADMIN.name,
        email: ADMIN.email,
        password: ADMIN.password,
        role: "admin",
        createdAt: new Date().toISOString(),
      });
      console.log("[seed-admin] Admin creado:", ADMIN.email, "(pass:", ADMIN.password, ")");
    }
  
    localStorage.setItem(KEY, JSON.stringify(db));
  })();
  