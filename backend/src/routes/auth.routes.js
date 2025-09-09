import { Router } from "express";
import db from "../db/migrate.js";        // o ../db/index.js si lo separaste
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

// Reglas básicas (equivalentes al frontend)
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passRe  = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// ========== Registro ==========
router.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};

  const nameTrim  = String(name ?? "").trim();
  const emailNorm = String(email ?? "").trim().toLowerCase();
  const pass      = String(password ?? "");

  if (nameTrim.length < 2 || nameTrim.length > 60)
    return res.status(400).json({ error: "Nombre inválido (2–60)." });
  if (!emailRe.test(emailNorm))
    return res.status(400).json({ error: "Email inválido." });
  if (!passRe.test(pass))
    return res.status(400).json({ error: "Contraseña débil (8+, 1 min, 1 mayús, 1 número)." });

  try {
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(emailNorm);
    if (exists) return res.status(400).json({ error: "Email ya registrado." });

    const hash = bcrypt.hashSync(pass, 10);
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, 'user', ?)
    `).run(nameTrim, emailNorm, hash, new Date().toISOString());

    return res.status(201).json({
      id: Number(info.lastInsertRowid),
      name: nameTrim,
      email: emailNorm,
      role: "user"
    });
  } catch {
    return res.status(500).json({ error: "No se pudo registrar." });
  }
});

// ========== Login ==========
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const emailNorm = String(email ?? "").trim().toLowerCase();
  const pass      = String(password ?? "");

  // Buscar usuario por email
  const u = db.prepare("SELECT id, name, email, password_hash, role FROM users WHERE email = ?").get(emailNorm);
  if (!u) return res.status(401).json({ error: "Credenciales inválidas" });

  // Verificar password
  const ok = bcrypt.compareSync(pass, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  // Firmar JWT
  const token = jwt.sign(
    { sub: u.id, email: u.email, role: u.role },
    process.env.JWT_SECRET || "dev_secret",   // poné un secreto real en .env
    { expiresIn: "8h" }
  );

  // Devolver token + datos públicos del user
  return res.json({
    token,
    user: { id: u.id, name: u.name, email: u.email, role: u.role }
  });
});

export default router;
