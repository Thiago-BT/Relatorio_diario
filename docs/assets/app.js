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
    solicitacao_proposta:0,
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
        Object.keys(defaultRow()).forEach(k=>{
          parsed[p][k] = toInt(parsed[p][k] ?? 0);
        });
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
    Object.keys(out).forEach(k=>{
      out[k] += toInt(r[k]);
    });
  }
  return out;
}

function renderSums(sum, sumIds){
  Object.keys(sumIds).forEach(k=>{
    document.getElementById(sumIds[k]).textContent = sum[k];
  });
}

function makeRow(name, data, onChange){
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  tdName.textContent = name;
  tr.appendChild(tdName);

  const fields = [
    "casos",
    "positivos",
    "solicitacao_proposta",
    "restrito",
    "aptos",
    "aguardando",
    "reunioes_agendadas",
    "reunioes_realizadas"
  ];

  fields.forEach(f=>{
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.className = "cellInput";
    input.value = toInt(data?.[f] ?? 0);
    input.addEventListener("input", () => onChange(name, f, input.value));
    td.appendChild(input);
    tr.appendChild(td);
  });

  return tr;
}

function fillPdf(config, state){
  document.getElementById(config.pdf.dateId).textContent = formatDateBR(new Date());

  const sum = sumAll(state);
  Object.keys(config.pdf.sumMap).forEach(k=>{
    document.getElementById(config.pdf.sumMap[k]).textContent = sum[k];
  });

  const tbody = document.getElementById(config.pdf.tbodyId);
  tbody.innerHTML = "";

  config.people.forEach(person=>{
    const r = state[person] || defaultRow();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${person}</td>
      <td>${r.casos}</td>
      <td>${r.positivos}</td>
      <td>${r.solicitacao_proposta}</td>
      <td>${r.restrito}</td>
      <td>${r.aptos}</td>
      <td>${r.aguardando}</td>
      <td>${r.reunioes_agendadas}</td>
      <td>${r.reunioes_realizadas}</td>
    `;
    tbody.appendChild(tr);
  });
}

function generatePdf(rootEl, filename){
  rootEl.style.display = "block";

  const opt = {
    margin: 0,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor:"#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  html2pdf().set(opt).from(rootEl).save().then(()=>{
    rootEl.style.display = "none";
  });
}

function initPanel(config){
  let state = loadState(config.teamKey, config.people);

  const tbody = document.getElementById(config.ui.tbodyId);

  const rerender = () => {
    tbody.innerHTML = "";
    config.people.forEach(p=>{
      const tr = makeRow(p, state[p], (name, field, value)=>{
        state[name][field] = toInt(value);
        saveState(config.teamKey, state);
        renderSums(sumAll(state), config.ui.sumIds);
      });
      tbody.appendChild(tr);
    });
    renderSums(sumAll(state), config.ui.sumIds);
  };

  rerender();

  document.getElementById(config.ui.btnClearId).addEventListener("click", ()=>{
    const fresh = {};
    config.people.forEach(p=> fresh[p] = defaultRow());
    state = fresh;
    saveState(config.teamKey, state);
    rerender();
  });

  document.getElementById(config.ui.btnPdfId).addEventListener("click", ()=>{
    fillPdf(config, state);
    generatePdf(document.getElementById(config.pdf.rootId), config.pdf.filename);
  });
}