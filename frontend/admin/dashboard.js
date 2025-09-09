const API_ADMIN = `${API}/api/admin`;

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers||{}), ...Auth.header() }
  });
  const data = await r.json().catch(()=> ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part * 100) / total);
}

function isClosed(iso) {
  const now = new Date();
  const end = new Date(iso + "T23:59:59");
  return now > end;
}

async function load() {
  try {
    const polls = await fetchJSON(`${API_ADMIN}/polls`);
    render(polls);
  } catch (e) {
    document.querySelector('#polls').innerHTML = `<p class="error">${e.message}</p>`;
  }
}

function render(polls) {
  const root = document.querySelector('#polls');
  root.innerHTML = "";

  if (!polls.length) {
    root.innerHTML = `<p>No hay encuestas.</p>`;
    return;
  }

  for (const p of polls) {
    const closed = isClosed(p.closeDateISO);

    const card = document.createElement('div');
    card.className = 'poll-card';

    const h3 = document.createElement('h3');
    h3.textContent = p.question;

    const meta = document.createElement('div');
    meta.className = 'hint';
    meta.textContent = `ID ${p.id} • Tipo: ${p.responseType} • Cierra: ${p.closeDateISO} • Total votos: ${p.totalVotes} ${closed ? '• (CERRADA)' : ''}`;

    const list = document.createElement('div');
    list.className = 'options';

    for (const o of p.options) {
      const line = document.createElement('div');
      line.className = 'option-line';

      const label = document.createElement('span');
      label.textContent = o.text;

      const barWrap = document.createElement('div');
      barWrap.className = 'bar';

      const fill = document.createElement('div');
      const percent = pct(o.votes, p.totalVotes);
      fill.className = 'fill';
      fill.style.width = percent + '%';

      const right = document.createElement('span');
      right.className = 'right';
      right.textContent = `${percent}% (${o.votes})`;

      barWrap.appendChild(fill);
      line.appendChild(label);
      line.appendChild(barWrap);
      line.appendChild(right);
      list.appendChild(line);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnDelete = document.createElement('button');
    btnDelete.textContent = "Eliminar";
    btnDelete.onclick = async () => {
      if (!confirm("¿Eliminar encuesta? Esta acción es irreversible.")) return;
      try {
        await fetchJSON(`${API_ADMIN}/polls/${p.id}`, { method: "DELETE" });
        await load();
      } catch (e) { alert(e.message); }
    };

    actions.appendChild(btnDelete);

    card.appendChild(h3);
    card.appendChild(meta);
    card.appendChild(list);
    card.appendChild(actions);
    root.appendChild(card);
  }
}

// logout
document.querySelector("#btnLogout").onclick = ()=>{ Auth.clear(); location.href="../auth/login.html"; };

// cargar
document.addEventListener('DOMContentLoaded', load);
