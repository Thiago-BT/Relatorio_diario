function toInt(v){
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function formatDateBR(d = new Date()){
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function defaultRow(){
  return {
    casos:0,
    positivos:0,
    restrito:0,
    aptos:0,
    aguardando:0,
    reunioes_agendadas:0,
    reunioes_realizadas:0
  };
}

function loadState(teamKey, people){
  const raw = localStorage.getItem(teamKey);
  if(raw){
    try{
      const parsed = JSON.parse(raw);
      for(const p of people){
        if(!parsed[p]) parsed[p] = defaultRow();
        parsed[p].reunioes_agendadas = toInt(parsed[p].reunioes_agendadas ?? 0);
        parsed[p].reunioes_realizadas = toInt(parsed[p].reunioes_realizadas ?? 0);
      }
      return parsed;
    }catch(e){}
  }
  const fresh = {};
  for(const p of people) fresh[p] = defaultRow();
  return fresh;
}

function saveState(teamKey, state){
  localStorage.setItem(teamKey, JSON.stringify(state));
}

function sumAll(state){
  const out = defaultRow();
  for(const name of Object.keys(state)){
    const r = state[name] || defaultRow();
    out.casos += toInt(r.casos);
    out.positivos += toInt(r.positivos);
    out.restrito += toInt(r.restrito);
    out.aptos += toInt(r.aptos);
    out.aguardando += toInt(r.aguardando);
    out.reunioes_agendadas += toInt(r.reunioes_agendadas);
    out.reunioes_realizadas += toInt(r.reunioes_realizadas);
  }
  return out;
}

function renderSums(sum, sumIds){
  document.getElementById(sumIds.casos).textContent = sum.casos;
  document.getElementById(sumIds.positivos).textContent = sum.positivos;
  document.getElementById(sumIds.restrito).textContent = sum.restrito;
  document.getElementById(sumIds.aptos).textContent = sum.aptos;
  document.getElementById(sumIds.aguardando).textContent = sum.aguardando;
  document.getElementById(sumIds.reunioes_agendadas).textContent = sum.reunioes_agendadas;
  document.getElementById(sumIds.reunioes_realizadas).textContent = sum.reunioes_realizadas;
}

function makeRow(name, data, onChange){
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  tdName.textContent = name;
  tr.appendChild(tdName);

  const fields = [
    "casos","positivos","restrito","aptos","aguardando",
    "reunioes_agendadas","reunioes_realizadas"
  ];

  for(const f of fields){
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.inputMode = "numeric";
    input.className = "cellInput";
    input.value = toInt(data?.[f] ?? 0);
    input.addEventListener("input", () => onChange(name, f, input.value));
    td.appendChild(input);
    tr.appendChild(td);
  }
  return tr;
}

/**
 * Espera a imagem carregar (ou falhar) antes de gerar PDF
 */
function waitImage(img){
  if(!img) return Promise.resolve();

  // força uso de mesmo-origin quando possível (ajuda o canvas)
  // OBS: para imagens do mesmo site (GitHub Pages), funciona OK.
  img.crossOrigin = "anonymous";

  // se já carregou
  if(img.complete && img.naturalWidth > 0) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once:true });
    img.addEventListener("error", done, { once:true });
  });
}

async function fillPdf(config, state){
  document.getElementById(config.pdf.dateId).textContent = formatDateBR(new Date());

  // Logo
  let logoEl = null;
  if(config.pdf.logoId && config.pdf.logoSrc){
    logoEl = document.getElementById(config.pdf.logoId);
    if(logoEl){
      // set src e espera carregar
      logoEl.src = config.pdf.logoSrc;
      await waitImage(logoEl);

      // se falhou, remove para não quebrar o render
      if(!(logoEl.complete && logoEl.naturalWidth > 0)){
        logoEl.style.display = "none";
      }else{
        logoEl.style.display = "";
      }
    }
  }

  // Soma
  const sum = sumAll(state);
  for(const k of Object.keys(config.pdf.sumMap)){
    document.getElementById(config.pdf.sumMap[k]).textContent = sum[k];
  }

  // Tabela por negociador
  const tbody = document.getElementById(config.pdf.tbodyId);
  tbody.innerHTML = "";

  for(const person of config.people){
    const r = state[person] || defaultRow();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${person}</td>
      <td>${toInt(r.casos)}</td>
      <td>${toInt(r.positivos)}</td>
      <td>${toInt(r.restrito)}</td>
      <td>${toInt(r.aptos)}</td>
      <td>${toInt(r.aguardando)}</td>
      <td>${toInt(r.reunioes_agendadas)}</td>
      <td>${toInt(r.reunioes_realizadas)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function generatePdf(rootEl, filename){
  rootEl.style.display = "block";

  const opt = {
    margin: 0,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,     // ajuda quando o canvas “reclama”
      backgroundColor: "#ffffff"
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  return html2pdf().set(opt).from(rootEl).save().then(() => {
    rootEl.style.display = "none";
  }).catch(() => {
    rootEl.style.display = "none";
  });
}

function initPanel(config){
  let state = loadState(config.teamKey, config.people);

  const tbody = document.getElementById(config.ui.tbodyId);
  const rerender = () => {
    tbody.innerHTML = "";
    for(const p of config.people){
      const tr = makeRow(p, state[p], (name, field, value) => {
        state[name] = state[name] || defaultRow();
        state[name][field] = toInt(value);
        saveState(config.teamKey, state);
        renderSums(sumAll(state), config.ui.sumIds);
      });
      tbody.appendChild(tr);
    }
    renderSums(sumAll(state), config.ui.sumIds);
  };

  rerender();

  document.getElementById(config.ui.btnClearId).addEventListener("click", () => {
    const fresh = {};
    for(const p of config.people) fresh[p] = defaultRow();
    state = fresh;
    saveState(config.teamKey, state);
    rerender();
  });

  document.getElementById(config.ui.btnPdfId).addEventListener("click", async () => {
    const root = document.getElementById(config.pdf.rootId);
    await fillPdf(config, state);
    generatePdf(root, config.pdf.filename);
  });
}