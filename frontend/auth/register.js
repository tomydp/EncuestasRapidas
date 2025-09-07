const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passRe=/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

document.querySelector("#f").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name  = document.querySelector("#name").value.trim();
  const email = document.querySelector("#email").value.trim().toLowerCase();
  const pass  = document.querySelector("#pass").value;
  const pass2 = document.querySelector("#pass2").value;
  const err   = document.querySelector("#err"); err.textContent = "";

  if (name.length < 2 || name.length > 60) return err.textContent = "Nombre inválido (2–60).";
  if (!emailRe.test(email))               return err.textContent = "Email inválido.";
  if (!passRe.test(pass))                 return err.textContent = "Contraseña débil (8+, 1 min, 1 mayús, 1 número).";
  if (pass !== pass2)                     return err.textContent = "Las contraseñas no coinciden.";

  try {
    const r = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password: pass })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "No se pudo registrar");
    location.href = "./login.html";
  } catch (e) { err.textContent = e.message; }
});
