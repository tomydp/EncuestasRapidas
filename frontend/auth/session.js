// Ajusta si tu API cambia de host/puerto
window.API = "http://localhost:3000";

window.Auth = {
  get() {
    try { return JSON.parse(localStorage.getItem("session") || "null"); }
    catch { return null; }
  },
  set(token, user) {
    localStorage.setItem("session", JSON.stringify({ token, user }));
  },
  clear() { localStorage.removeItem("session"); },
  header() {
    const s = this.get();
    return s?.token ? { Authorization: `Bearer ${s.token}` } : {};
  },
  require(role) {
    const s = this.get();
    if (!s) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `../auth/login.html?next=${next}`;
      return null;
    }
    if (role && s.user?.role !== role) {
      // si no es admin, lo mandamos a votar
      location.href = "../public/index.html";
      return null;
    }
    return s;
  }
};

// Requiere que el usuario tenga alguno de estos roles, si no redirige
Auth.requireRole = function (...roles) {
  const s = Auth.require(); // ya existente (exige sesión)
  const myRole = s?.user?.role || "user";
  if (!roles.includes(myRole)) {
    // Sin permiso -> mandamos al index público
    location.href = "../public/index.html";
    throw new Error("No autorizado");
  }
  return s;
};

