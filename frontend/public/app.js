// ===================== Sesión =====================
const s = Auth.require(); // exige estar logueado
document.querySelector("#who").textContent = s.user?.name || s.user?.email;
document.querySelector("#btnLogout").onclick = () => {
  Auth.clear();
  location.href = "../auth/login.html";
};

// ===================== Utilidades =====================
const $ = (q) => document.querySelector(q);
const API = typeof window.API === "string" ? window.API : "http://localhost:3000";

function isClosed(iso) {
  return new Date() > new Date(iso + "T23:59:59");
}
function timeLeft(iso) {
  const end = new Date(iso + "T23:59:59"), now = new Date();
  let d = Math.max(0, end - now);
  if (!d) return "cerró";
  const D = Math.floor(d / 86400000); d -= D * 86400000;
  const H = Math.floor(d / 3600000);  d -= H * 3600000;
  const M = Math.floor(d / 60000);
  if (D > 0) return `${D} día${D > 1 ? "s" : ""} ${H}h`;
  if (H > 0) return `${H}h ${M}m`;
  return `${M} min`;
}

// ===================== Toast =====================
const toastBox = $("#toast");
function showToast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " error" : "");
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ===================== Skeleton =====================
const pollsList = $("#pollsList");
function showSkeleton(n = 6) {
  pollsList.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton";
    sk.innerHTML = `
      <div class="s-line" style="width:60%"></div>
      <div class="s-line" style="width:30%"></div>
      <div class="s-line" style="width:90%"></div>
      <div class="s-line" style="width:75%"></div>
    `;
    pollsList.appendChild(sk);
  }
}

// ===================== Recibos de voto =====================
// Guarda QUÉ opciones votó la persona por encuesta, para:
// 1) Bloquear doble voto en UI y 2) Dejar marcadas sus opciones
const VOTES_KEY = "__polls_voted__";

const readVotes = () => { try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "{}"); } catch { return {}; } };
const writeVotes = (m) => localStorage.setItem(VOTES_KEY, JSON.stringify(m));

function getMyVoteValues(userId, pollId) {
  const m = readVotes();
  return m?.[userId]?.[pollId]?.values || null;   // array de strings o null
}
function hasVoted(userId, pollId) {
  return !!getMyVoteValues(userId, pollId);
}
function markVoted(userId, pollId, values) {
  const m = readVotes();
  m[userId] = m[userId] || {};
  m[userId][pollId] = { values: Array.from(new Set(values)) };
  writeVotes(m);
}

// ===================== Carga / listado =====================
async function loadPolls(q = "") {
  showSkeleton();
  try {
    const url = q ? `${API}/api/polls?q=${encodeURIComponent(q)}` : `${API}/api/polls`;
    const res = await fetch(url);
    const polls = await res.json();
    renderPolls(polls);
  } catch (e) {
    pollsList.innerHTML = `<div class="empty"><span class="emo">😵‍💫</span>Error al cargar encuestas.</div>`;
  }
}

function renderPolls(polls) {
  pollsList.innerHTML = "";
  if (!polls.length) {
    pollsList.innerHTML = `<div class="empty"><span class="emo">🗳️</span>No hay encuestas.</div>`;
    return;
  }

  for (const p of polls) {
    const total = p.options.reduce((a, o) => a + (o.votes || 0), 0);
    const closed = isClosed(p.closeDateISO);
    const already = hasVoted(s.user.id, p.id);
    const myVals = getMyVoteValues(s.user.id, p.id) || [];

    const card = document.createElement("div");
    card.className = "card";

    // Header
    const header = document.createElement("div");
    header.innerHTML = `
      <h3>${p.question}</h3>
      <div class="hint">
        ID ${p.id} • Tipo: ${p.responseType} • Cierra: ${p.closeDateISO}
        ${closed ? `<span class="chip red">CERRADA</span>`
                 : `<span class="chip gray">Faltan ${timeLeft(p.closeDateISO)}</span>`}
        ${already ? ` <span class="chip">Ya votaste</span>` : ``}
      </div>
    `;
    card.appendChild(header);

    // Opciones
    const form = document.createElement("div");
    form.style.marginTop = "8px";

    const name = `opt-${p.id}`;
    const inputType = p.responseType === "single" ? "radio" : "checkbox";

    for (const opt of p.options) {
      const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;

      const row = document.createElement("div");
      row.className = "option";

      const input = document.createElement("input");
      input.type = inputType;
      input.name = name;
      input.value = opt.text;

      // Si ya votó y esta opción fue elegida, dejarla marcada
      if (already && myVals.includes(opt.text)) {
        input.checked = true;
        row.classList.add("myvote"); // estilo opcional
      }

      input.disabled = closed || already;

      const middle = document.createElement("div");
      const label = document.createElement("div"); label.textContent = opt.text;
      const barWrap = document.createElement("div"); barWrap.className = "bar-wrap";
      const bar = document.createElement("div"); bar.className = "bar"; bar.style.width = pct + "%";
      barWrap.appendChild(bar);
      middle.append(label, barWrap);

      const pctEl = document.createElement("div");
      pctEl.className = "pct";
      pctEl.textContent = `${pct}%`;

      row.append(input, middle, pctEl);
      form.appendChild(row);
    }

    // Acciones
    const actions = document.createElement("div");
    const btn = document.createElement("button");
    btn.textContent = "Votar";
    btn.disabled = closed || already;
    const msg = document.createElement("div");
    msg.className = "error";
    msg.style.marginLeft = "8px";
    actions.append(btn, msg);

    btn.onclick = async () => {
      msg.textContent = "";
      try {
        if (already) { msg.textContent = "Ya votaste esta encuesta."; return; }

        let payload, chosenValues;

        if (p.responseType === "single") {
          const sel = document.querySelector(`input[name="${name}"]:checked`);
          if (!sel) { msg.textContent = "Elegí una opción."; return; }
          chosenValues = [sel.value];
          payload = { option: sel.value };
        } else {
          const vals = [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
          if (!vals.length) { msg.textContent = "Elegí al menos una opción."; return; }
          chosenValues = vals;
          payload = { options: vals };
        }

        const r = await fetch(`${API}/api/polls/${p.id}/vote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // si usás backend real con auth tipo Bearer:
            "Authorization": s.token ? "Bearer " + s.token : undefined
          },
          body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "No se pudo votar");

        // Guardar qué opciones marcó este usuario para esta encuesta
        markVoted(s.user.id, p.id, chosenValues);

        showToast("¡Voto registrado!");
        await loadPolls($("#search").value.trim());
      } catch (e) {
        msg.textContent = e.message;
        showToast(e.message, "error");
      }
    };

    card.append(form, actions);
    pollsList.appendChild(card);
  }
}

// ===================== Controles =====================
$("#btnSearch").onclick = () => loadPolls($("#search").value.trim());
$("#btnReload").onclick = () => { $("#search").value = ""; loadPolls(); };
document.addEventListener("DOMContentLoaded", () => loadPolls());
