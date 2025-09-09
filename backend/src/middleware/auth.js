import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret";

// Requiere JWT válido (pone user en req.user)
export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const p = jwt.verify(token, SECRET);
    req.user = { id: p.sub, email: p.email, role: p.role };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Requiere rol exacto
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}
