// Gate de admin
const s = Auth.require("admin");
if (!s) throw new Error("redirigiendo…");
document.querySelector("#who").textContent = s.user?.name || s.user?.email || "admin";
document.querySelector("#btnLogout").onclick = ()=>{ Auth.clear(); location.href="../auth/login.html"; };

const $=(s)=>document.querySelector(s);
const questionRe=/^[\p{L}\p{N}\s.,;:?!¡¿'"()-]{10,140}$/u;
const optionLineRe=/^[^<>]{1,50}$/;
const validTypes=["single","multiple"];

function sanitize(t){ return DOMPurify.sanitize(String(t??"").trim(),{ALLOWED_TAGS:[],ALLOWED_ATTR:[]}).replace(/\s{2,}/g," "); }
function futureDateISO(dateStr){ const d=new Date(dateStr+"T00:00:00"); if(Number.isNaN(d.getTime()))return false; const t=new Date(); t.setHours(0,0,0,0); return d.getTime()>t.getTime(); }
function validateOptions(raw){
  const lines = raw.split("\n").map(s=>sanitize(s)).filter(Boolean);
  if(lines.length<2||lines.length>10) return {ok:false,msg:"Debe haber entre 2 y 10 opciones.",lines:[]};
  for(const l of lines) if(!optionLineRe.test(l)) return {ok:false,msg:`Opción inválida: "${l}"`,lines:[]};
  return {ok:true,msg:"",lines:[...new Set(lines)]};
}
function showPreview(lines){ $("#optionsPreview").textContent = lines.length? `Vista previa: ${lines.join(" | ")}`:""; }

$("#options").addEventListener("input", e=>{
  const v = validateOptions(e.target.value);
  $("#errOptions").textContent = v.ok? "" : v.msg;
  showPreview(v.ok? v.lines: []);
});

$("#pollForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  $("#errQuestion").textContent=$("#errOptions").textContent=$("#errResponseType").textContent=$("#errCloseDate").textContent=$("#result").textContent="";

  const question = sanitize($("#question").value);
  const optionsRaw = $("#options").value;
  const responseType = document.querySelector('input[name="responseType"]:checked')?.value;
  const closeDate = $("#closeDate").value;

  if(!questionRe.test(question)) return $("#errQuestion").textContent="Pregunta inválida (10–140, sin HTML).";
  const opts = validateOptions(optionsRaw); if(!opts.ok) return $("#errOptions").textContent = opts.msg;
  if(!validTypes.includes(responseType)) return $("#errResponseType").textContent="Tipo inválido.";
  if(!futureDateISO(closeDate)) return $("#errCloseDate").textContent="La fecha debe ser futura.";

  try{
    const r = await fetch(`${API}/api/admin/polls`,{
      method:"POST",
      headers:{ "Content-Type":"application/json", ...Auth.header() },
      body: JSON.stringify({ question, options: opts.lines, responseType, closeDate })
    });
    const d = await r.json(); if(!r.ok) throw new Error(d?.error || "No se pudo crear");
    $("#result").textContent = `Encuesta creada (id ${d.id}).`;
    e.target.reset(); showPreview([]);
  }catch(e){ $("#errQuestion").textContent = e.message; }
});
