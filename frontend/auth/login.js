document.querySelector("#f").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = document.querySelector("#email").value.trim().toLowerCase();
    const pass  = document.querySelector("#pass").value;
    const err   = document.querySelector("#err"); err.textContent="";
  
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Credenciales inválidas");
  
      // Guardar sesión (token + user con rol)
      Auth.set(d.token, d.user);
  
      // Redirigir según rol
      const next = new URLSearchParams(location.search).get("next");
      if (d.user?.role === "admin") {
        location.href = "../admin/create.html";
      } else {
        location.href = next || "../public/index.html";
      }
    } catch (e) { err.textContent = e.message; }
  });
  