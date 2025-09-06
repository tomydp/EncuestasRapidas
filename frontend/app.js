const $ = (s) => document.querySelector(s);

const questionRe = /^[\p{L}\p{N}\s.,;:?!¡¿'"()-]{10,140}$/u;
const optionLineRe = /^[^<>]{1,50}$/; // sin < > y <= 50 chars
const validResponseTypes = ["single", "multiple"];

function futureDateISO(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  return d.getTime() > today.getTime();
}

function sanitizeText(t) {
  // Sanitiza y además quita espacios extremos y normaliza múltiples espacios
  const clean = DOMPurify.sanitize(t, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return clean.trim().replace(/\s{2,}/g, " ");
}

function validateOptions(raw) {
  // Split por líneas no vacías
  const lines = raw.split("\n").map(s => sanitizeText(s)).filter(Boolean);
  if (lines.length < 2 || lines.length > 10) {
    return { ok:false, msg:"Debe haber entre 2 y 10 opciones.", lines:[] };
  }
  for (const line of lines) {
    if (!optionLineRe.test(line)) {
      return { ok:false, msg:`Opción inválida: "${line}"`, lines:[] };
    }
  }
  return { ok:true, msg:"", lines:[...new Set(lines)] }; // deduplicadas
}

function showOptionsPreview(lines) {
  $("#optionsPreview").textContent = lines.length ? `Vista previa: ${lines.join(" | ")}` : "";
}

$("#options").addEventListener("input", (e) => {
  const raw = e.target.value;
  const v = validateOptions(raw);
  $("#errOptions").textContent = v.ok ? "" : v.msg;
  showOptionsPreview(v.ok ? v.lines : []);
});

$("#pollForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Reset errores
  $("#errQuestion").textContent = "";
  $("#errOptions").textContent = "";
  $("#errResponseType").textContent = "";
  $("#errCloseDate").textContent = "";
  $("#result").textContent = "";

  // Leer y sanitizar
  const question = sanitizeText($("#question").value);
  const optionsRaw = $("#options").value;
  const responseType = document.querySelector('input[name="responseType"]:checked')?.value;
  const closeDate = $("#closeDate").value;

  // Validaciones frontend
  if (!questionRe.test(question)) {
    $("#errQuestion").textContent = "Pregunta inválida (10–140, sin HTML).";
    return;
  }

  const opts = validateOptions(optionsRaw);
  if (!opts.ok) {
    $("#errOptions").textContent = opts.msg;
    return;
  }

  if (!validResponseTypes.includes(responseType)) {
    $("#errResponseType").textContent = "Tipo de respuesta inválido.";
    return;
  }

  if (!futureDateISO(closeDate)) {
    $("#errCloseDate").textContent = "La fecha debe ser futura.";
    return;
  }

  // Payload seguro (el backend ignorará cualquier intento de enviar voteCount)
  const payload = {
    question,
    options: opts.lines,
    responseType,
    closeDate,
    // voteCount enviado por consigna, pero lo ignorará el backend
    voteCount: $("#voteCount").value
  };

  try {
    const res = await fetch("http://localhost:3000/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error desconocido");
    $("#result").textContent = `Encuesta creada con id ${data.id}.`;
    // limpiar
    $("#pollForm").reset();
    showOptionsPreview([]);
  } catch (err) {
    $("#result").textContent = "";
    $("#errQuestion").textContent = err.message;
  }
});

// -------- LISTADO Y VOTO --------
const API_BASE = "http://localhost:3000";

async function loadPolls(query = "") {
  const url = query ? `${API_BASE}/api/polls?q=${encodeURIComponent(query)}` 
                    : `${API_BASE}/api/polls`;
  const res = await fetch(url);
  const polls = await res.json();
  renderPolls(polls);
}

function renderPolls(polls) {
  const cont = $("#pollsList");
  cont.innerHTML = "";
  if (!polls.length) {
    cont.innerHTML = "<p>No hay encuestas.</p>";
    return;
  }

  for (const p of polls) {
    const closed = isClosed(p.closeDateISO);
    const card = document.createElement("div");
    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "12px";

    const title = document.createElement("h3");
    title.textContent = p.question;

    const meta = document.createElement("div");
    meta.className = "hint";
    meta.textContent = `ID ${p.id} • Tipo: ${p.responseType} • Cierra: ${p.closeDateISO} ${closed ? "• (CERRADA)" : ""}`;

    const form = document.createElement("div");
    form.style.marginTop = "8px";

    // Inputs de opciones
    if (p.responseType === "single") {
      p.options.forEach(opt => {
        const label = document.createElement("label");
        label.style.display = "block";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `opt-${p.id}`;
        input.value = opt.text;
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + opt.text + `  (${opt.votes})`));
        form.appendChild(label);
      });
    } else {
      p.options.forEach(opt => {
        const label = document.createElement("label");
        label.style.display = "block";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = `opt-${p.id}`;
        input.value = opt.text;
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + opt.text + `  (${opt.votes})`));
        form.appendChild(label);
      });
    }

    const btnVote = document.createElement("button");
    btnVote.textContent = "Votar";
    btnVote.style.marginTop = "8px";
    btnVote.disabled = closed;

    const msg = document.createElement("div");
    msg.className = "error";
    msg.style.marginTop = "6px";

    btnVote.addEventListener("click", async () => {
      msg.textContent = "";
      try {
        let payload;
        if (p.responseType === "single") {
          const sel = document.querySelector(`input[name="opt-${p.id}"]:checked`);
          if (!sel) {
            msg.textContent = "Elegí una opción.";
            return;
          }
          payload = { option: sel.value };
        } else {
          const checks = [...document.querySelectorAll(`input[name="opt-${p.id}"]:checked`)];
          const values = checks.map(c => c.value);
          if (!values.length) {
            msg.textContent = "Elegí al menos una opción.";
            return;
          }
          payload = { options: values };
        }

        const res = await fetch(`${API_BASE}/api/polls/${p.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No se pudo votar");
        // Recargar listado para ver los nuevos contadores
        await loadPolls($("#search").value.trim());
      } catch (err) {
        msg.textContent = err.message;
      }
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(form);
    card.appendChild(btnVote);
    card.appendChild(msg);
    cont.appendChild(card);
  }
}

function isClosed(closeDateISO) {
  const now = new Date();
  const closes = new Date(closeDateISO + "T23:59:59");
  return now > closes;
}

// Controles de búsqueda/recarga
$("#btnSearch").addEventListener("click", () => {
  const q = $("#search").value.trim();
  loadPolls(q);
});
$("#btnReload").addEventListener("click", () => {
  $("#search").value = "";
  loadPolls();
});

// Cargar al abrir la página
document.addEventListener("DOMContentLoaded", () => {
  loadPolls();
});

