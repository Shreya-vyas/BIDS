import { analytics } from "./analytics.js";
import { liveFeed }  from "../data/live-feed.js";

/* ─── Tabs ───────────────────────────────────────────────────── */
const tabs = [
  { id: "liveintel",    label: "🔴 Live Intel" },
  { id: "landscape",    label: "AI Hiring Landscape" },
  { id: "geo",          label: "Geo Intelligence" },
  { id: "funding",      label: "Funding vs Hiring" },
  { id: "growth",       label: "Growth Intelligence" },
  { id: "skills",       label: "Skill Premiums" },
  { id: "predictor",    label: "Startup Predictor" },
  { id: "risk",         label: "Layoff Risk" },
  { id: "market",       label: "Market Intel" },
  { id: "compensation", label: "Compensation" },
  { id: "models",       label: "Scraping + Models" },
  { id: "advanced",     label: "Advanced Analytics" }
];

const PAL  = ["#057a74","#3460cc","#b86e00","#d04535","#6340a8","#1f7a3e","#0ea5a0","#7a60d0","#c06020","#2a6090"];
const PALD = ["#0fc4bc","#5d8af7","#f0a020","#f07060","#a070e8","#4cba72","#14d4cc","#a090f0","#f08040","#40a0d0"];

let chartInstances = {};

/* ─── State ──────────────────────────────────────────────────── */
const state = { tab: "liveintel", industry: "All", stage: "All", search: "", minSuccess: 0, dark: false, liveFilter: "ALL" };

/* ─── DOM refs ───────────────────────────────────────────────── */
const el = {
  tabs:        document.querySelector("#tabs"),
  kpis:        document.querySelector("#kpis"),
  dashboard:   document.querySelector("#dashboard"),
  industry:    document.querySelector("#industry"),
  stage:       document.querySelector("#stage"),
  search:      document.querySelector("#search"),
  risk:        document.querySelector("#risk"),
  riskLabel:   document.querySelector("#riskLabel"),
  tooltip:     document.querySelector("#tooltip"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon:   document.querySelector("#themeIcon"),
  exportBtn:   document.querySelector("#exportBtn"),
  ticker:      document.querySelector("#ticker"),
  tickerInner: document.querySelector("#tickerInner"),
};

/* ─── Utilities ──────────────────────────────────────────────── */
const money  = v => v >= 1000 ? `$${analytics.round(v/1000,1)}B` : `$${analytics.round(v,0)}M`;
const fmt    = v => new Intl.NumberFormat("en-US").format(Math.round(v));
const pct    = v => `${analytics.round(v,1)}%`;
const esc    = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pal    = () => state.dark ? PALD : PAL;
const grid   = () => state.dark ? "#243048" : "#dde3dd";
const tick   = () => state.dark ? "#7a8aa8" : "#6b7280";
const alpha  = (hex,a) => { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };
const liveAge = ts => { const m=Math.round((Date.now()-ts)/60000); return m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:m<10080?`${Math.round(m/1440)}d ago`:`${Math.round(m/10080)}wk ago`; };

/* ─── Sparkline ──────────────────────────────────────────────── */
function sparkline(values, color) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const W = 72, H = 24;
  const pts = values.map((v,i) => [
    (i/(values.length-1))*W,
    H - ((v - min)/span)*H
  ]);
  const d = pts.map(([x,y],i) => `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fillPts = [...pts, [W, H], [0, H]];
  const fd = fillPts.map(([x,y],i) => `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + 'Z';
  const col = color || (state.dark ? '#0fc4bc' : '#057a74');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
    <defs><linearGradient id="sg${W}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${fd}" fill="url(#sg${W})"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ─── Tooltip ────────────────────────────────────────────────── */
let ttTimeout;
function showTip(html, ev) { clearTimeout(ttTimeout); el.tooltip.innerHTML = html; el.tooltip.classList.add("visible"); posTip(ev); }
function posTip(ev) {
  const pad=14, W=window.innerWidth, H=window.innerHeight;
  const tw=el.tooltip.offsetWidth||190, th=el.tooltip.offsetHeight||52;
  let x=ev.clientX+pad, y=ev.clientY-th/2;
  if(x+tw>W-8) x=ev.clientX-tw-pad;
  if(y<8) y=8;
  if(y+th>H-8) y=H-th-8;
  el.tooltip.style.left=`${x}px`; el.tooltip.style.top=`${y}px`;
}
function hideTip() { ttTimeout=setTimeout(()=>el.tooltip.classList.remove("visible"),120); }

function bindTips(root) {
  root.querySelectorAll("[data-tip]").forEach(n => {
    n.addEventListener("mouseenter", e => showTip(n.dataset.tip, e));
    n.addEventListener("mousemove",  e => posTip(e));
    n.addEventListener("mouseleave", hideTip);
  });
}

/* ─── Dark mode ──────────────────────────────────────────────── */
const SUN  = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
const MOON = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
function applyTheme() {
  document.documentElement.dataset.theme = state.dark ? "dark" : "light";
  el.themeIcon.innerHTML = state.dark ? MOON : SUN;
}

/* ─── CSV Export ─────────────────────────────────────────────── */
function exportCSV() {
  const cos = filteredCompanies();
  const hdr = ["Company","Industry","Stage","HQ","Founded","Employees","AI Jobs","6M Avg Jobs","Revenue Growth%","AI Hiring Growth%","Momentum","Funding $M","Success%","LayoffRisk%","IPO Readiness%","AI Intensity%","PMF Score","Velocity Score","Funding Efficiency","Health"];
  const rows = cos.map(c => [c.name,c.industry,c.stage,c.hq,c.founded,c.employees,c.currentAiJobs,c.sixMonthAvgJobs,c.revenueGrowth,c.aiHiringGrowth,c.hiringMomentum,c.fundingTotal,c.successProbability,c.layoffRisk,c.ipoReadiness,c.aiIntensity,c.pmfScore,c.velocityScore,c.fundingEfficiency,c.health]);
  const csv = [hdr,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="ai_talent_intelligence.csv"; a.click();
}

/* ─── Filter ─────────────────────────────────────────────────── */
function filteredCompanies() {
  const q = state.search.trim().toLowerCase();
  return analytics.companyScores.filter(c => {
    if(state.industry!=="All" && c.industry!==state.industry) return false;
    if(state.stage!=="All" && c.stage!==state.stage) return false;
    if(c.successProbability<state.minSuccess) return false;
    if(q && !(c.name.toLowerCase().includes(q)||c.hq.toLowerCase().includes(q)||c.skills.join(" ").toLowerCase().includes(q))) return false;
    return true;
  });
}

/* ─── Controls ───────────────────────────────────────────────── */
function populateControls() {
  const uniq = arr => ["All",...new Set(arr)].sort((a,b)=>a==="All"?-1:b==="All"?1:a.localeCompare(b));
  const mk   = arr => arr.map(v=>`<option>${esc(v)}</option>`).join("");
  el.industry.innerHTML = mk(uniq(analytics.companies.map(c=>c.industry)));
  el.stage.innerHTML    = mk(uniq(analytics.companies.map(c=>c.stage)));
}

function renderTabs() {
  el.tabs.innerHTML = tabs.map(t=>`
    <button class="tab" data-tab="${t.id}" aria-selected="${state.tab===t.id}">${esc(t.label)}</button>`).join("");
}

/* ─── KPI cards with sparklines ─────────────────────────────── */
let prevKpi = {};
function renderKpis(cos) {
  if(!cos.length) { el.kpis.innerHTML=""; return; }
  const jobs    = cos.reduce((s,c)=>s+c.currentAiJobs,0);
  const funding = cos.reduce((s,c)=>s+c.fundingTotal,0);
  const avgMom  = cos.reduce((s,c)=>s+c.hiringMomentum,0)/cos.length;
  const avgSucc = cos.reduce((s,c)=>s+c.successProbability,0)/cos.length;
  const avgAI   = cos.reduce((s,c)=>s+c.aiIntensity,0)/cos.length;
  const avgEff  = cos.filter(c=>c.fundingEfficiency>0).reduce((s,c)=>s+c.fundingEfficiency,0)/
                  Math.max(1,cos.filter(c=>c.fundingEfficiency>0).length);

  // Sparkline data: last 12 months of total hiring
  const trend12 = analytics.totalMonthlyHiring(cos).slice(-12).map(p=>p.openings);
  const mom12   = analytics.totalMonthlyHiring(cos).slice(-12).map(p=>p.revenueIndex);

  const items = [
    { label:"Total AI Openings",    id:"kpi0", val:jobs,    fmt:fmt,    note:`${cos.length} companies · filtered`, spark:trend12 },
    { label:"Funding Tracked",      id:"kpi1", val:funding, fmt:money,  note:"Public + synthetic funding layer", spark:null },
    { label:"Avg Hiring Momentum",  id:"kpi2", val:avgMom,  fmt:v=>analytics.round(v,2), note:"Current ÷ 6-month average", spark:mom12 },
    { label:"Avg Success Score",    id:"kpi3", val:avgSucc, fmt:v=>`${analytics.round(v,1)}%`, note:"ML-predicted next-round success", spark:null },
    { label:"Avg AI Intensity",     id:"kpi4", val:avgAI,   fmt:v=>`${analytics.round(v,1)}%`, note:"AI roles as % of total workforce", spark:null },
    { label:"Avg Funding Efficiency",id:"kpi5",val:avgEff,  fmt:v=>analytics.round(v,2), note:"Revenue index per $100M raised", spark:null }
  ];

  el.kpis.innerHTML = items.map(k=>`
    <article class="kpi">
      <div class="kpi-label">${esc(k.label)}</div>
      <div class="kpi-value" id="${k.id}">—</div>
      <div class="kpi-note">${esc(k.note)}</div>
      ${k.spark ? `<div class="kpi-spark" id="${k.id}spark"></div>` : ""}
    </article>`).join("");

  items.forEach((k,i) => {
    const vEl = document.getElementById(k.id);
    const from = prevKpi[i] ?? 0;
    const to   = k.val;
    const dur  = 650;
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now-start)/dur,1);
      const ease = 1-(1-p)**3;
      vEl.textContent = k.fmt(from + (to-from)*ease);
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prevKpi[i] = to;

    if(k.spark) {
      const sparkEl = document.getElementById(k.id+"spark");
      if(sparkEl) sparkEl.innerHTML = sparkline(k.spark);
    }
  });
}

/* ─── Chart.js factory ───────────────────────────────────────── */
function destroyChart(id) { if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];} }

const tooltipDefaults = () => ({
  backgroundColor: state.dark ? "#141a28" : "#14181f",
  titleColor: "#e8eef8",
  bodyColor: "#b8c4d8",
  borderColor: grid(),
  borderWidth: 1,
  padding: 11,
  cornerRadius: 8,
  displayColors: true,
  boxWidth: 10, boxHeight: 10
});

function lineChart(id, labels, datasets, opts={}) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext("2d");
  if(!ctx) return;
  chartInstances[id] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:"index", intersect:false },
      plugins: {
        legend: { labels:{ color:tick(), font:{size:11,family:"Inter"}, boxWidth:12 } },
        tooltip: tooltipDefaults()
      },
      scales: {
        x: { grid:{color:grid()}, ticks:{color:tick(),maxTicksLimit:8,font:{size:10}} },
        y: { grid:{color:grid()}, ticks:{color:tick(),font:{size:10}}, ...opts.yAxis }
      }
    }
  });
}

function barChartH(id, labels, values, colors, label="") {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext("2d");
  if(!ctx) return;
  chartInstances[id] = new Chart(ctx, {
    type:"bar",
    data:{ labels, datasets:[{ label, data:values, backgroundColor:colors, borderRadius:5, borderSkipped:false }] },
    options:{
      indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:tooltipDefaults() },
      scales:{
        x:{ grid:{color:grid()}, ticks:{color:tick(),font:{size:10}} },
        y:{ grid:{display:false}, ticks:{color:tick(),font:{size:11}} }
      }
    }
  });
}

function barChartV(id, labels, datasets) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext("2d");
  if(!ctx) return;
  chartInstances[id] = new Chart(ctx, {
    type:"bar",
    data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{color:tick(),font:{size:11,family:"Inter"},boxWidth:12} }, tooltip:tooltipDefaults() },
      scales:{
        x:{ grid:{display:false}, ticks:{color:tick(),font:{size:10}} },
        y:{ grid:{color:grid()}, ticks:{color:tick(),font:{size:10}} }
      }
    }
  });
}

function radarChart(id, labels, datasets) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext("2d");
  if(!ctx) return;
  chartInstances[id] = new Chart(ctx, {
    type:"radar",
    data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{color:tick(),font:{size:11,family:"Inter"},boxWidth:12}}, tooltip:tooltipDefaults() },
      scales:{ r:{
        grid:{color:grid()}, angleLines:{color:grid()},
        ticks:{color:tick(),font:{size:9},backdropColor:"transparent"},
        pointLabels:{color:tick(),font:{size:11}}
      }}
    }
  });
}

function doughnutChart(id, labels, values, colors) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext("2d");
  if(!ctx) return;
  chartInstances[id] = new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data:values, backgroundColor:colors, borderColor:"transparent", borderWidth:0, hoverOffset:6 }] },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:"68%",
      plugins:{ legend:{position:"right",labels:{color:tick(),font:{size:11,family:"Inter"},boxWidth:12,padding:12}}, tooltip:tooltipDefaults() }
    }
  });
}

/* ─── SVG helpers ────────────────────────────────────────────── */
function svgScatter(points) {
  const W=760, H=320, pad=50;
  const maxX=Math.max(...points.map(p=>p.fundingTotal),1);
  const maxY=Math.max(...points.map(p=>p.currentAiJobs),1);
  const p=pal();
  // Regression line
  const xs=points.map(pt=>pt.fundingTotal), ys=points.map(pt=>pt.currentAiJobs);
  const xm=xs.reduce((s,v)=>s+v,0)/xs.length, ym=ys.reduce((s,v)=>s+v,0)/ys.length;
  const slope=xs.reduce((s,x,i)=>s+(x-xm)*(ys[i]-ym),0)/xs.reduce((s,x)=>s+(x-xm)**2,0)||0;
  const intc=ym-slope*xm;
  const rx1=0, ry1=intc, rx2=maxX, ry2=slope*maxX+intc;
  const sx1=pad+(rx1/maxX)*(W-pad*2), sy1=H-pad-(ry1/maxY)*(H-pad*2);
  const sx2=pad+(rx2/maxX)*(W-pad*2), sy2=H-pad-(ry2/maxY)*(H-pad*2);
  return `<div class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter">
      <rect width="${W}" height="${H}" rx="12" fill="transparent"/>
      ${[0,1,2,3,4].map(i=>{const y=pad+i*((H-pad*2)/4);return `<line x1="${pad}" x2="${W-pad}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="4 3"/>`;}).join("")}
      <line x1="${pad}" x2="${W-pad}" y1="${H-pad}" y2="${H-pad}" stroke="var(--line-solid)"/>
      <line x1="${pad}" x2="${pad}" y1="${pad}" y2="${H-pad}" stroke="var(--line-solid)"/>
      <line x1="${sx1}" y1="${Math.max(pad,Math.min(H-pad,sy1))}" x2="${sx2}" y2="${Math.max(pad,Math.min(H-pad,sy2))}"
        stroke="var(--blue)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>
      ${points.map((pt,i)=>{
        const x=pad+(pt.fundingTotal/maxX)*(W-pad*2);
        const y=H-pad-(pt.currentAiJobs/maxY)*(H-pad*2);
        const r=7+Math.min(15,pt.aiHiringGrowth/22);
        const tip=`<b>${esc(pt.company)}</b>\nFunding: ${money(pt.fundingTotal)}\nAI Jobs: ${fmt(pt.currentAiJobs)}\nHiring Growth: ${pct(pt.aiHiringGrowth)}\nStage: ${esc(pt.stage)}`;
        return `<g data-tip="${esc(tip)}" style="cursor:default">
          <circle cx="${x}" cy="${y}" r="${r+5}" fill="${p[i%p.length]}" opacity="0.10"/>
          <circle cx="${x}" cy="${y}" r="${r}" fill="${p[i%p.length]}" opacity="0.88"/>
          <text x="${x+r+4}" y="${y+4}" fill="var(--ink2)" font-size="10" font-family="Inter">${esc(pt.company.split(" ")[0])}</text>
        </g>`;
      }).join("")}
      <text x="${pad}" y="${H-10}" fill="var(--muted)" font-size="11" font-family="Inter">← Funding Total ($M)</text>
      <text x="10" y="${pad-8}" fill="var(--muted)" font-size="11" font-family="Inter">AI Jobs ↑</text>
    </svg>
  </div>`;
}

function svgHeatmap(rows) {
  const max=Math.max(...rows.map(r=>r.selectedDemand),1);
  return `<div class="chart"><svg viewBox="0 0 760 310" role="img" aria-label="Skill heatmap">
    <rect width="760" height="310" rx="12" fill="transparent"/>
    ${rows.slice(0,12).map((r,i)=>{
      const col=i%4, row=Math.floor(i/4);
      const x=20+col*184, y=20+row*96;
      const a=0.12+(r.selectedDemand/max)*0.78;
      const tip=`${esc(r.skill)}\nOpenings: ${fmt(r.selectedDemand)}\nAvg Salary: $${fmt(r.avgSalary)}\nFamily: ${esc(r.family)}`;
      return `<g data-tip="${esc(tip)}" style="cursor:default">
        <rect x="${x}" y="${y}" width="172" height="80" rx="9" fill="var(--teal)" opacity="${a}" stroke="var(--line)" stroke-width="1"/>
        <text x="${x+12}" y="${y+28}" fill="var(--ink)" font-size="13" font-weight="700" font-family="Inter">${esc(r.skill)}</text>
        <text x="${x+12}" y="${y+50}" fill="var(--muted)" font-size="11" font-family="Inter">${fmt(r.selectedDemand)} openings</text>
        <text x="${x+12}" y="${y+68}" fill="var(--muted)" font-size="11" font-family="Inter">$${fmt(r.avgSalary)} avg salary</text>
      </g>`;
    }).join("")}
  </svg></div>`;
}

function svgGeoMap(hubs) {
  const maxJ=Math.max(...hubs.map(h=>h.jobs),1);
  const p=pal();
  const px=lon=>36+((lon+180)/360)*688, py=lat=>28+((80-lat)/130)*252;
  const continents=`
    <path d="M72 58 L130 50 L180 47 L220 57 L248 79 L260 107 L252 131 L224 148 L200 160 L188 178 L200 195 L210 208 L196 218 L180 212 L162 200 L140 192 L120 185 L104 170 L88 154 L74 136 L66 112 L68 88Z" fill="var(--line)" opacity="0.55"/>
    <path d="M192 220 L218 216 L238 222 L254 238 L260 258 L258 278 L248 292 L232 298 L216 294 L204 280 L196 260 L192 240Z" fill="var(--line)" opacity="0.55"/>
    <path d="M338 58 L380 53 L410 57 L428 67 L432 81 L422 93 L402 99 L380 95 L362 87 L344 79Z" fill="var(--line)" opacity="0.55"/>
    <path d="M360 103 L400 99 L430 108 L446 128 L448 156 L442 180 L432 200 L412 212 L390 216 L370 208 L354 186 L348 162 L350 138 L356 115Z" fill="var(--line)" opacity="0.55"/>
    <path d="M432 59 L540 47 L620 51 L680 61 L712 77 L720 97 L704 115 L680 125 L648 127 L616 121 L580 117 L548 119 L520 127 L496 123 L470 111 L448 95 L436 77Z" fill="var(--line)" opacity="0.55"/>`;
  return `<div class="chart"><svg viewBox="0 0 760 310" role="img" aria-label="Geo map">
    <rect width="760" height="310" rx="12" fill="var(--surface2)"/>${continents}
    ${hubs.map((h,i)=>{
      const x=px(h.lon), y=py(h.lat), r=7+(h.jobs/maxJ)*24;
      const tip=`<b>${esc(h.city)}</b>\nJobs: ${fmt(h.jobs)}\nSalary: $${fmt(h.salary)}\nGrowth: ${pct(h.growthRate)}\nRemote: ${pct(h.remoteShare)}`;
      return `<g data-tip="${esc(tip)}" style="cursor:default">
        <circle cx="${x}" cy="${y}" r="${r+5}" fill="${p[i%p.length]}" opacity="0.12"/>
        <circle cx="${x}" cy="${y}" r="${r}" fill="${p[i%p.length]}" opacity="0.84"/>
        <text x="${x+r+4}" y="${y+4}" font-size="10" fill="var(--ink2)" font-family="Inter">${esc(h.city)}</text>
      </g>`;
    }).join("")}
  </svg></div>`;
}

function svgGeoScore(hubs, flows=[]) {
  const maxJ=Math.max(...hubs.map(h=>h.jobs),1);
  const byCity=new Map(hubs.map(h=>[h.city,h]));
  const px=lon=>36+((lon+180)/360)*688, py=lat=>28+((80-lat)/130)*252;
  const continents=`
    <path d="M72 58 L130 50 L180 47 L220 57 L248 79 L260 107 L252 131 L224 148 L200 160 L188 178 L200 195 L210 208 L196 218 L180 212 L162 200 L140 192 L120 185 L104 170 L88 154 L74 136 L66 112 L68 88Z" fill="var(--line)" opacity="0.45"/>
    <path d="M192 220 L218 216 L238 222 L254 238 L260 258 L258 278 L248 292 L232 298 L216 294 L204 280 L196 260 L192 240Z" fill="var(--line)" opacity="0.45"/>
    <path d="M338 58 L380 53 L410 57 L428 67 L432 81 L422 93 L402 99 L380 95 L362 87 L344 79Z" fill="var(--line)" opacity="0.45"/>
    <path d="M432 59 L540 47 L620 51 L680 61 L712 77 L720 97 L704 115 L680 125 L648 127 L616 121 L580 117 L548 119 L520 127 L496 123 L470 111 L448 95 L436 77Z" fill="var(--line)" opacity="0.45"/>`;
  return `<div class="chart"><svg viewBox="0 0 760 350" role="img" aria-label="Geo intelligence map">
    <rect width="760" height="350" rx="12" fill="var(--surface2)"/>${continents}
    ${flows.map(f=>{
      const fm=byCity.get(f.from), to=byCity.get(f.to); if(!fm||!to) return "";
      const x1=px(fm.lon),y1=py(fm.lat),x2=px(to.lon),y2=py(to.lat);
      return `<path d="M${x1} ${y1} Q${(x1+x2)/2} ${Math.min(y1,y2)-28} ${x2} ${y2}" fill="none" stroke="var(--blue)" stroke-width="${1+f.value/24}" opacity="0.22"/>`;
    }).join("")}
    ${hubs.map(h=>{
      const x=px(h.lon), y=py(h.lat), r=7+(h.jobs/maxJ)*24;
      const fill=h.recommendedPlay==="Build hub"?"var(--green)":h.recommendedPlay==="Remote-first"?"var(--coral)":"var(--teal)";
      const tip=`<b>${esc(h.city)}</b>\nExpansion: ${h.expansionScore}\nOverheat Risk: ${h.overheatingRisk}\nPlay: ${esc(h.recommendedPlay)}\nJobs: ${fmt(h.jobs)}`;
      return `<g data-tip="${esc(tip)}" style="cursor:default">
        <circle cx="${x}" cy="${y}" r="${r+4}" fill="${fill}" opacity="0.13"/>
        <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="0.86"/>
        <text x="${x+r+4}" y="${y-2}" font-size="10" fill="var(--ink)" font-weight="700" font-family="Inter">${esc(h.city)}</text>
        <text x="${x+r+4}" y="${y+13}" font-size="9" fill="var(--muted)" font-family="Inter">${h.expansionScore}</text>
      </g>`;
    }).join("")}
  </svg>
  <div class="legend">
    <span><i class="dot" style="background:var(--green)"></i>Build hub</span>
    <span><i class="dot"></i>Selective hiring</span>
    <span><i class="dot" style="background:var(--coral)"></i>Remote-first</span>
    <span><i class="dot" style="background:var(--blue)"></i>Talent flow</span>
  </div></div>`;
}

function svgTreemap(rows) {
  const p=pal();
  const rCount=rows.length>4?2:1, split=Math.ceil(rows.length/rCount);
  const groups=rCount===1?[rows]:[rows.slice(0,split),rows.slice(split)];
  const renderGroup=(group,y,h)=>{
    const total=group.reduce((s,r)=>s+r.openings,0)||1;
    const gap=7, usW=716-gap*Math.max(0,group.length-1);
    let x=20;
    return group.map(r=>{
      const w=(r.openings/total)*usW, cx=x; x+=w+gap;
      const ci=rows.indexOf(r), show=w>88;
      const tip=`<b>${esc(r.industry)}</b>\nOpenings: ${fmt(r.openings)}\nCompanies: ${r.companies}\nGrowth: ${pct(r.growth)}`;
      return `<g data-tip="${esc(tip)}" style="cursor:default">
        <rect x="${cx}" y="${y}" width="${w}" height="${h}" rx="9" fill="${p[ci%p.length]}" opacity="0.88"/>
        <text x="${cx+11}" y="${y+26}" fill="white" font-size="12" font-weight="700" font-family="Inter">${esc(r.industry)}</text>
        ${show?`<text x="${cx+11}" y="${y+44}" fill="rgba(255,255,255,0.85)" font-size="11" font-family="Inter">${fmt(r.openings)} jobs · ${pct(r.growth)}</text>`:""}
      </g>`;
    }).join("");
  };
  return `<div class="chart"><svg viewBox="0 0 760 248" role="img" aria-label="Industry treemap">
    <rect width="760" height="248" rx="12" fill="transparent"/>
    ${groups.map((g,i)=>renderGroup(g,i===0?20:128,90)).join("")}
  </svg></div>`;
}

function svgCorrHeatmap(matrix) {
  const size=72;
  return `<div class="chart"><svg viewBox="0 0 760 616" role="img" aria-label="Correlation matrix">
    <rect width="760" height="616" rx="12" fill="transparent"/>
    ${matrix.map((row,ri)=>`
      <text x="14" y="${100+ri*size}" fill="var(--ink2)" font-size="11" font-weight="700" font-family="Inter">${esc(row.metric)}</text>
      ${row.values.map((cell,ci)=>{
        const v=cell.correlation;
        const a=Math.min(0.88,Math.abs(v)*0.7+0.12);
        const fill=v>=0?`rgba(5,122,116,${a})`:`rgba(208,69,53,${a})`;
        const tip=`${esc(row.metric)} × ${esc(cell.metric)}\nCorrelation: ${v}`;
        return `<g data-tip="${esc(tip)}" style="cursor:default">
          ${ri===0?`<text x="${130+ci*size}" y="40" fill="var(--muted)" font-size="10" text-anchor="middle" font-family="Inter">${esc(cell.metric)}</text>`:""}
          <rect x="${94+ci*size}" y="${66+ri*size}" width="56" height="56" rx="7" fill="${fill}" stroke="var(--line)" stroke-width="1"/>
          <text x="${122+ci*size}" y="${99+ri*size}" fill="var(--ink)" font-size="12" text-anchor="middle" font-weight="700" font-family="Inter">${v}</text>
        </g>`;
      }).join("")}`).join("")}
  </svg></div>`;
}

function svgSankey(flows) {
  const p=pal(), max=Math.max(...flows.map(f=>f.value),1);
  return `<div class="chart"><svg viewBox="0 0 760 390" role="img" aria-label="Talent migration">
    <rect width="760" height="390" rx="12" fill="transparent"/>
    ${flows.map((f,i)=>{
      const y=30+i*30, stroke=2+(f.value/max)*12;
      const tip=`${esc(f.from)} → ${esc(f.to)}\nVolume: ${f.value}`;
      return `<g data-tip="${esc(tip)}" style="cursor:default">
        <text x="26" y="${y+5}" font-size="12" fill="var(--ink2)" font-family="Inter">${esc(f.from)}</text>
        <path d="M165 ${y} C300 ${y-26}, 440 ${y+26}, 580 ${y}" fill="none" stroke="${p[i%p.length]}" stroke-width="${stroke}" opacity="0.58"/>
        <text x="604" y="${y+5}" font-size="12" fill="var(--ink)" font-family="Inter" font-weight="600">${esc(f.to)}</text>
        <text x="516" y="${y-8}" font-size="10" fill="var(--muted)" font-family="Inter">${f.value}</text>
      </g>`;
    }).join("")}
  </svg></div>`;
}

/* ─── Panel builder ──────────────────────────────────────────── */
function panel(title, sub, body, span=6, badge="", cls="") {
  return `<article class="panel span-${span}${cls?` ${cls}`:""}">
    <div class="panel-header">
      <div><h2>${esc(title)}</h2>${sub?`<p class="panel-sub">${esc(sub)}</p>`:""}</div>
      ${badge?`<span class="badge">${esc(badge)}</span>`:""}
    </div>${body}</article>`;
}

function metricsRow(tiles) {
  return `<div class="metrics-row">${tiles.map(t=>`
    <div class="metric-tile">
      <span class="tile-num">${esc(t.value)}</span>
      <span class="tile-label">${esc(t.label)}</span>
    </div>`).join("")}</div>`;
}

function companyTable(cos) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Company</th><th>Industry</th><th>AI Jobs</th><th>Rev Growth</th><th>Hiring Growth</th><th>Momentum</th><th>AI Intensity</th><th>Health</th></tr></thead>
    <tbody>${cos.map(c=>`<tr>
      <td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.hq)}</span></td>
      <td>${esc(c.industry)}</td>
      <td>${fmt(c.currentAiJobs)}</td>
      <td>${pct(c.revenueGrowth)}</td>
      <td>${pct(c.aiHiringGrowth)}</td>
      <td>${c.hiringMomentum}</td>
      <td>${pct(c.aiIntensity)}</td>
      <td><span class="health ${c.health}">${c.health}</span></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function geoHubTable(hubs) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>City</th><th>Jobs</th><th>Salary</th><th>Remote</th><th>Talent</th><th>Expansion</th><th>Risk</th><th>Play</th></tr></thead>
    <tbody>${hubs.map(h=>`<tr>
      <td><strong>${esc(h.city)}</strong><br><span class="muted">${esc(h.country)}</span></td>
      <td>${fmt(h.jobs)}</td>
      <td>$${fmt(h.salary)}</td>
      <td>${pct(h.remoteShare)}</td>
      <td>${h.talentSupply}</td>
      <td><div style="display:flex;align-items:center;gap:7px">${h.expansionScore}
        <div class="bar-track" style="width:52px;flex:0 0 52px"><div class="bar-fill" style="width:${h.expansionScore}%;background:var(--green)"></div></div>
      </div></td>
      <td>${h.overheatingRisk}</td>
      <td><span class="health ${h.recommendedPlay==="Build hub"?"Expansion":h.recommendedPlay==="Remote-first"?"Contraction":"Stable"}">${esc(h.recommendedPlay)}</span></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

/* ─── Ticker ─────────────────────────────────────────────────── */
function initTicker() {
  if(!el.tickerInner) return;
  const items = liveFeed.articles.slice(0,14);
  if(!items.length) { el.ticker && (el.ticker.style.display="none"); return; }
  const SIG_ICONS = { FUNDING:"💰", HIRING:"📈", PRODUCT:"🚀", RISK:"⚠️", GENERAL:"📰" };
  const html = items.map(a=>`
    <span class="tick-item signal-${a.signal.toLowerCase()}">
      <span class="tick-icon">${SIG_ICONS[a.signal]||"📰"}</span>
      <a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a>
      <span class="tick-src">${esc(a.src)}</span>
      <span class="tick-age">${liveAge(a.pubTs)}</span>
    </span>`).join('<span class="tick-divider">·</span>');
  // Double for seamless loop
  el.tickerInner.innerHTML = html + '<span class="tick-divider">·</span>' + html;
}

/* ─── Live Intel Dashboard ───────────────────────────────────── */
function dashLiveIntel() {
  const feed      = liveFeed;
  const articles  = feed.articles;
  const meta      = feed.meta;
  const buckets   = feed.hourlyBuckets;
  const mentions  = meta.mentionCounts || [];
  const sigCounts = meta.signalCounts  || {};
  const scrapedAt = meta.scrapedAt ? new Date(meta.scrapedAt).toLocaleString() : "—";
  const p         = pal();

  const SIG_ICONS  = { FUNDING:"💰", HIRING:"📈", PRODUCT:"🚀", RISK:"⚠️", GENERAL:"📰" };
  const SIG_LABELS = { FUNDING:"Funding", HIRING:"Hiring", PRODUCT:"Product", RISK:"Risk Alert", GENERAL:"General" };

  // Filter articles
  const filtered = state.liveFilter === "ALL"
    ? articles
    : articles.filter(a => a.signal === state.liveFilter);

  // Overall market sentiment
  const scored     = articles.filter(a => typeof a.sentiment === "number");
  const avgSentiment = scored.length
    ? Math.round(scored.reduce((s,a)=>s+a.sentiment,0)/scored.length*100)/100
    : 0;
  const sentClass  = avgSentiment >= 0.4 ? "positive" : avgSentiment >= 0 ? "neutral" : "negative";

  const html = `<div class="grid">

    <!-- KPI strip -->
    ${panel("Live Market Intelligence",`Last scraped: ${scrapedAt} · ${meta.totalArticles} articles · ${meta.errors?.length||0} feed errors`,`
      ${metricsRow([
        { value: meta.totalArticles||0, label:"Articles" },
        { value: sigCounts.FUNDING||0,  label:"💰 Funding signals" },
        { value: sigCounts.HIRING||0,   label:"📈 Hiring signals" },
        { value: sigCounts.RISK||0,     label:"⚠️ Risk alerts" },
        { value: `${avgSentiment>=0?"+":""}${avgSentiment}`, label:"Market sentiment" },
      ])}`,9,"Live feed")}

    <!-- Sentiment timeline -->
    ${panel("24h Sentiment Timeline","Hourly avg sentiment of news articles. Green = bullish, red = bearish.",`
      <div class="chart" style="height:180px"><canvas id="sentimentChart" style="height:180px"></canvas></div>`,3,"Hourly")}

    <!-- Signal filter buttons + feed -->
    ${panel("Breaking News Feed",`Filtered: ${filtered.length} of ${articles.length} articles`,`
      <div class="signal-filters">
        ${["ALL","FUNDING","HIRING","PRODUCT","RISK"].map(s=>`
          <button class="sig-btn${state.liveFilter===s?" active":""}" data-sig="${s}">
            ${SIG_ICONS[s]||"📰"} ${SIG_LABELS[s]||s} ${s!=="ALL"?`(${sigCounts[s]||0})`:`(${articles.length})`}
          </button>`).join("")}
      </div>
      <div class="news-feed" id="newsFeed">
        ${filtered.slice(0,20).map(a=>`
          <article class="news-card signal-${a.signal.toLowerCase()}" data-tip="${esc(a.title)}\nSource: ${esc(a.src)}\nAge: ${liveAge(a.pubTs)}\nSentiment: ${a.sentiment}">
            <div class="news-header">
              <span class="news-signal signal-badge-${a.signal.toLowerCase()}">${SIG_ICONS[a.signal]} ${SIG_LABELS[a.signal]}</span>
              <span class="news-src">${esc(a.src)}</span>
              <span class="news-age">${liveAge(a.pubTs)}</span>
              <span class="news-sent ${a.sentiment>=0.3?"sent-pos":a.sentiment<=-0.3?"sent-neg":"sent-neutral"}">${a.sentiment>=0?"+":""}${a.sentiment}</span>
            </div>
            <h3 class="news-title"><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
            <p class="news-desc">${esc(a.desc)}</p>
            ${a.companies.length?`<div class="news-companies">${a.companies.map(c=>`<span class="badge accent">${esc(c)}</span>`).join("")}</div>`:""}
          </article>`).join("")}
      </div>`,8,"News")}

    <!-- Company mention leaderboard -->
    ${panel("Company Mention Frequency","How often each company appears in AI news this cycle.",`
      <div class="split-list">${mentions.slice(0,12).map(([company,count],i)=>`
        <div class="rank-row" data-tip="${esc(company)}: ${count} mentions">
          <strong style="font-size:0.85rem">${esc(company)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${(count/Math.max(...mentions.map(m=>m[1]),1))*100}%;background:${p[i%p.length]}"></div></div>
          <span>${count}</span>
        </div>`).join("")}`,4,"Mentions")}

    <!-- Signal distribution doughnut -->
    ${panel("Signal Mix","Distribution of article signal types.",`
      <div class="chart" style="height:200px"><canvas id="sigMixChart" style="height:200px"></canvas></div>`,2,"Mix")}

    <!-- Market sentiment gauge -->
    ${panel("Composite Market Sentiment",`Avg across all ${scored.length} scored articles.`,`
      <div class="gauge-row" style="justify-content:center;text-align:center;padding:20px 0">
        <div>
          <div class="gauge-num ${sentClass}" style="font-size:3.5rem">${avgSentiment>=0?"+":""}${avgSentiment}</div>
          <div class="gauge-label">${avgSentiment>=0.5?"🟢 Strongly bullish":avgSentiment>=0.2?"🟡 Mildly bullish":avgSentiment>=-0.1?"⚪ Neutral":avgSentiment>=-0.4?"🟠 Cautious":"🔴 Bearish"}</div>
          <div style="margin-top:14px;font-size:0.82rem;color:var(--muted)">Based on ${scored.length} articles · Refreshed hourly</div>
        </div>
      </div>`,2,"Gauge")}

    <!-- Risk watch -->
    ${panel("Risk Watchlist","Companies mentioned alongside negative keywords.",`
      <div class="company-list">${articles.filter(a=>a.signal==="RISK").slice(0,6).map(a=>`
        <div class="company-card" data-tip="${esc(a.title)}\nSentiment: ${a.sentiment}">
          <strong class="news-title" style="font-size:0.84rem">${esc(a.title.slice(0,70))}…</strong>
          ${a.companies.length?`<div style="margin-top:6px">${a.companies.map(c=>`<span class="badge" style="background:var(--coral);color:white">${esc(c)}</span>`).join("")}</div>`:""}
          <div class="metric-line" style="margin-top:6px"><span>${esc(a.src)}</span><b style="color:var(--coral)">${liveAge(a.pubTs)}</b></div>
        </div>`).join("")}`,6,"⚠️ Risk")}

    <!-- Feed sources -->
    ${panel("Data Sources","RSS feeds powering the live intel pipeline. Run `node scripts/scraper.mjs` to refresh.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Source</th><th>URL</th><th>Status</th><th>Cadence</th></tr></thead>
        <tbody>
          <tr><td><strong>TechCrunch AI</strong></td><td>techcrunch.com/category/artificial-intelligence/feed/</td><td><span class="health Expansion">Live</span></td><td>Hourly</td></tr>
          <tr><td><strong>VentureBeat AI</strong></td><td>venturebeat.com/category/ai/feed/</td><td><span class="health Expansion">Live</span></td><td>Hourly</td></tr>
          <tr><td><strong>The Verge AI</strong></td><td>theverge.com/ai-artificial-intelligence/rss/index.xml</td><td><span class="health Expansion">Live</span></td><td>Hourly</td></tr>
          <tr><td><strong>MIT Tech Review</strong></td><td>technologyreview.com/feed/</td><td><span class="health Expansion">Live</span></td><td>Hourly</td></tr>
          <tr><td><strong>AI News</strong></td><td>artificialintelligence-news.com/feed/</td><td><span class="health Expansion">Live</span></td><td>Hourly</td></tr>
        </tbody>
      </table>
      <div class="insight" style="margin-top:14px">
        <strong>To refresh live data:</strong> run <code>node scripts/scraper.mjs</code> or <code>bash scripts/start.sh</code> to start everything.
        The scraper reads 5 RSS feeds, extracts company mentions from our 22 tracked companies, classifies each article as
        FUNDING / HIRING / PRODUCT / RISK using keyword matching, scores sentiment, and writes <code>data/live-feed.js</code>.
        The dashboard reloads this file on every page refresh.
      </div>`,6,"Sources")}
  </div>`;

  setTimeout(()=>{
    // Sentiment chart
    const validBuckets = buckets.filter(b=>b.avg!==null);
    const sentColors = buckets.map(b=>
      b.avg===null?"transparent":
      b.avg>=0.3?p[5]+"cc":b.avg<=-0.3?p[3]+"cc":p[2]+"cc");
    destroyChart("sentimentChart");
    const sCtx = document.getElementById("sentimentChart")?.getContext("2d");
    if(sCtx) chartInstances["sentimentChart"] = new Chart(sCtx, {
      type:"bar",
      data:{ labels:buckets.map(b=>b.hour), datasets:[{
        label:"Avg Sentiment",
        data:buckets.map(b=>b.avg),
        backgroundColor:sentColors,
        borderRadius:4,
        borderSkipped:false
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:tooltipDefaults() },
        scales:{
          x:{ grid:{display:false}, ticks:{color:tick(),font:{size:9},maxTicksLimit:12} },
          y:{ grid:{color:grid()}, ticks:{color:tick(),font:{size:9}}, min:-1, max:1,
              plugins:{tooltip:{callbacks:{label:v=>`Sentiment: ${v.raw}`}}} }
        }
      }
    });

    // Signal mix doughnut
    const sigKeys = ["FUNDING","HIRING","PRODUCT","RISK"];
    const sigVals = sigKeys.map(k=>sigCounts[k]||0);
    doughnutChart("sigMixChart",
      sigKeys.map(k=>SIG_LABELS[k]),
      sigVals,
      [p[5],p[1],p[0],p[3]]);

    // Signal filter buttons
    document.querySelectorAll(".sig-btn").forEach(btn => {
      btn.addEventListener("click", ()=>{
        state.liveFilter = btn.dataset.sig;
        renderDashboard();
      });
    });

    bindTips(el.dashboard);
  },0);
  return html;
}

/* ─── DASHBOARDS ─────────────────────────────────────────────── */

function dashLandscape(cos) {
  const trend   = analytics.totalMonthlyHiring(cos);
  const skills  = analytics.skillDemandMatrix(cos);
  const inds    = analytics.industrySummary(cos);
  const conc    = analytics.marketConcentration(cos);
  const p       = pal();

  const html = `<div class="grid">
    ${panel("AI Hiring Trend + Forecast","42-month series with revenue index overlay.",`
      <div class="chart" style="height:290px"><canvas id="trendChart" style="height:290px"></canvas></div>
      <div class="legend"><span><i class="dot"></i>AI Openings</span><span><i class="dot" style="background:var(--blue)"></i>Revenue Index</span></div>`,8,"Leading indicator")}
    ${panel("Skill Demand Heatmap","AI openings weighted by company hiring volume.",svgHeatmap(skills),4,"Heatmap")}
    ${panel("Geographic Hiring Map","Bubble size = market depth by city.",svgGeoMap(analytics.geoHubs),5,"Remote adjusted")}
    ${panel("Industry Treemap","Industry share of AI openings and hiring growth.",svgTreemap(inds),4,"Market mix")}
    ${panel("Company Market Dominance","Share of total AI openings by company.",`
      <div class="chart" style="height:220px"><canvas id="dominanceChart" style="height:220px"></canvas></div>`,3,"Concentration")}
  </div>`;

  setTimeout(()=>{
    const months = trend.map(p=>p.month);
    const opens  = trend.map(p=>p.openings);
    const revs   = trend.map(p=>p.revenueIndex);

    lineChart("trendChart", months, [
      { label:"AI Openings", data:opens, borderColor:p[0], backgroundColor:alpha(p[0],.10), fill:true, tension:0.38, pointRadius:0, pointHoverRadius:5, borderWidth:2.5 },
      { label:"Revenue Index", data:revs, borderColor:p[1], backgroundColor:"transparent", fill:false, tension:0.38, pointRadius:0, pointHoverRadius:4, borderWidth:2, borderDash:[6,4] }
    ]);

    barChartH("dominanceChart",
      conc.companies.slice(0,8).map(c=>c.name),
      conc.companies.slice(0,8).map(c=>c.share),
      conc.companies.slice(0,8).map((_,i)=>p[i%p.length]+"cc"),
      "Market Share %");

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashGeo() {
  const summary  = analytics.geoSummary();
  const hubs     = [...analytics.geoScores].sort((a,b)=>b.expansionScore-a.expansionScore);
  const clusters = analytics.geoClusterSummary().sort((a,b)=>b.jobs-a.jobs);
  const p        = pal();

  const html = `<div class="grid">
    ${panel("AI Location Intelligence Map","Cities scored by talent supply, salary efficiency, funding density, and competition.",svgGeoScore(hubs,analytics.geoTalentFlows),8,"Geo model")}
    ${panel("Top Expansion Hubs",`Best: ${summary.bestExpansion.city} · Overheated: ${summary.overheated.city}`,`
      ${metricsRow([{value:fmt(summary.totalJobs),label:"Total Jobs"},{value:"$"+fmt(summary.avgSalary),label:"Avg Salary"},{value:pct(summary.avgRemote),label:"Avg Remote"}])}
      <div class="company-list">${hubs.slice(0,5).map(h=>`
        <div class="company-card" data-tip="${esc(h.city)}\nExpansion: ${h.expansionScore}\nRisk: ${h.overheatingRisk}\nPlay: ${esc(h.recommendedPlay)}">
          <strong>${esc(h.city)}<span class="muted" style="font-weight:400"> · ${esc(h.country)}</span></strong>
          <div class="metric-line"><span>Expansion score</span><b>${h.expansionScore}</b></div>
          <div class="bar-track"><div class="bar-fill" style="width:${h.expansionScore}%;background:var(--green)"></div></div>
          <div class="metric-line"><span>Overheating risk</span><b>${h.overheatingRisk}</b></div>
        </div>`).join("")}</div>`,4,`${fmt(summary.totalJobs)} jobs`)}
    ${panel("City Market Table","Cost-adjusted talent markets and recommended hiring strategies.",geoHubTable(hubs),8,"Location strategy")}
    ${panel("Hub Clusters","Mega hubs, efficient growth, research, remote-friendly, emerging.",`
      <div class="company-list">${clusters.slice(0,8).map(h=>`
        <div class="company-card">
          <strong>${esc(h.city)}</strong>
          <div class="metric-line"><span>Cluster</span><b>${esc(h.cluster)}</b></div>
          <div class="metric-line"><span>Salary efficiency</span><b>${h.salaryEfficiency}</b></div>
          <div class="metric-line"><span>Supply-demand balance</span><b>${h.supplyDemandBalance}</b></div>
        </div>`).join("")}</div>`,4,"Clustering")}
    ${panel("Geo Correlation Matrix","Which location signals move together — essential before building a location model.",svgCorrHeatmap(analytics.geoCorrelationMatrix()),12,"EDA")}
  </div>`;

  setTimeout(()=>bindTips(el.dashboard),0);
  return html;
}

function dashFunding(cos) {
  const points = analytics.fundingHiringPoints(cos);
  const surges = analytics.fundingSurgeSummary(cos);
  const corr   = points.length>1 ? analytics.estimateCorrelation(points,"fundingTotal","currentAiJobs") : 0;
  const stage  = analytics.stageIntelligence(cos);
  const p      = pal();

  const html = `<div class="grid">
    ${panel("Funding vs AI Jobs (with regression)","Bubble size = hiring growth rate. Line = OLS regression.",svgScatter(points),7,`r = ${corr}`)}
    ${panel("Funding Event → Hiring Surge","Post-event hiring expansion 6 months after round closes.",`
      <div class="timeline">${surges.slice(0,10).map(e=>`
        <div class="event" data-tip="${esc(e.company)}\nRound: ${esc(e.round)}\nAmount: ${money(e.amount)}\nSurge: ${pct(e.surge)}">
          <time>${esc(e.date)}</time>
          <div><strong>${esc(e.company)} — ${esc(e.round)}</strong>
            <div class="event-line"><span style="width:${Math.max(4,Math.min(100,e.surge))}%"></span></div></div>
          <span>${pct(e.surge)}</span>
        </div>`).join("")}</div>`,5,"Lag analysis")}
    ${panel("AI Jobs by Funding Stage","Distribution of hiring activity across company maturity stages.",`
      <div class="chart" style="height:220px"><canvas id="stageJobChart" style="height:220px"></canvas></div>`,6,"Stage breakdown")}
    ${panel("Stage Intelligence","Avg growth, success probability, and salary by funding stage.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Stage</th><th>Cos</th><th>Jobs</th><th>Funding</th><th>Avg Growth</th><th>Avg Success</th><th>Avg Salary</th></tr></thead>
        <tbody>${stage.map(s=>`<tr>
          <td><strong>${esc(s.stage)}</strong></td>
          <td>${s.count}</td>
          <td>${fmt(s.totalJobs)}</td>
          <td>${money(s.totalFunding)}</td>
          <td>${pct(s.avgGrowth)}</td>
          <td>${pct(s.avgSuccess)}</td>
          <td>$${fmt(s.avgSalary)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`,6,"Avg metrics")}
    ${panel("Key Insight","",`<div class="insight">
      Funding-hiring correlation: <strong>r = ${corr}</strong> (${Math.abs(corr)>=0.7?"strong":"moderate"} positive).
      The highest signal comes from companies where new capital triggers <em>sustained</em> AI role velocity over 6+ months rather than a single spike.
      Stage matters: Late Stage and Pre-IPO companies show the most consistent hiring ramp post-funding.
    </div>`,12)}
  </div>`;

  setTimeout(()=>{
    barChartV("stageJobChart",
      stage.map(s=>s.stage),
      [{ label:"Total AI Jobs", data:stage.map(s=>s.totalJobs), backgroundColor:stage.map((_,i)=>p[i%p.length]+"cc"), borderRadius:5, borderSkipped:false }]);
    bindTips(el.dashboard);
  },0);
  return html;
}

function dashGrowth(cos) {
  const sorted  = [...cos].sort((a,b)=>b.overHiringGap-a.overHiringGap);
  const fc      = analytics.forecastHiring(cos);
  const p       = pal();

  const html = `<div class="grid">
    ${panel("Revenue Growth vs AI Hiring Growth","Leading indicators, over-hiring, and under-hiring signals.",companyTable(sorted),8,"Growth signal")}
    ${panel("Over-Hiring Watchlist","Gap = AI hiring growth minus revenue growth. Positive = potential over-extension.",`
      <div class="company-list">${sorted.slice(0,6).map(c=>`
        <div class="company-card" data-tip="${esc(c.name)}\nGap: ${pct(c.overHiringGap)}\nIPO Readiness: ${pct(c.ipoReadiness)}\nHealth: ${esc(c.health)}">
          <strong>${esc(c.name)}</strong>
          <div class="metric-line"><span>Hiring − Revenue gap</span><b style="color:${c.overHiringGap>0?"var(--coral)":"var(--green)"}">${pct(c.overHiringGap)}</b></div>
          <div class="metric-line"><span>IPO readiness</span><b>${pct(c.ipoReadiness)}</b></div>
          <div class="metric-line"><span>Health</span><b>${esc(c.health)}</b></div>
        </div>`).join("")}</div>`,4,"Gap analysis")}
    ${panel("Hiring Forecast (Linear Regression)","Trend extrapolated 6 months from last 12-month OLS slope.",`
      ${metricsRow([{value:fmt(fc.currentOpenings),label:"Current Openings"},{value:fmt(fc.forecast[fc.forecast.length-1].openings),label:"Forecast Dec 2026"},{value:fc.slope>0?"+"+fc.slope:fc.slope,label:"Monthly Slope"},{value:fc.r2,label:"R² (fit)"}])}
      <div class="chart" style="height:240px"><canvas id="forecastChart" style="height:240px"></canvas></div>`,8,"Projection")}
    ${panel("Cohort Hiring Trajectories","Compare hiring ramp curves by founding era and company maturity.",`
      <div class="chart" style="height:240px"><canvas id="cohortChart" style="height:240px"></canvas></div>`,4,"Cohort")}
  </div>`;

  setTimeout(()=>{
    const history  = fc.trend.slice(-18);
    const allMonths = [...history.map(p=>p.month), ...fc.forecast.map(p=>p.month)];
    const histData  = [...history.map(p=>p.openings), ...fc.forecast.map(()=>null)];
    const fcstData  = [...history.map(()=>null), fc.trend[fc.trend.length-1].openings, ...fc.forecast.map(p=>p.openings)];
    const histFixed = [...history.map(p=>p.openings), fc.trend[fc.trend.length-1].openings, ...fc.forecast.map(()=>null)];

    lineChart("forecastChart",[...history.map(p=>p.month),...fc.forecast.map(p=>p.month)],[
      { label:"Historical", data:histFixed, borderColor:p[0], backgroundColor:alpha(p[0],.10), fill:true, tension:0.38, pointRadius:0, borderWidth:2.5 },
      { label:"Forecast",   data:[...history.map(()=>null),fc.trend[fc.trend.length-1].openings,...fc.forecast.map(p=>p.openings)],
        borderColor:p[3], backgroundColor:"transparent", fill:false, tension:0.38, pointRadius:4, borderWidth:2, borderDash:[6,4] }
    ]);

    destroyChart("cohortChart");
    const ctx=document.getElementById("cohortChart")?.getContext("2d");
    if(ctx) chartInstances["cohortChart"]=new Chart(ctx,{type:"line",data:{labels:["M0","M6","M12","M18","M24"],datasets:analytics.cohorts.map((r,i)=>({
      label:r.cohort, data:[r.month0,r.month6,r.month12,r.month18,r.month24],
      borderColor:p[i%p.length], backgroundColor:"transparent", tension:0.35, pointRadius:4, borderWidth:2.5
    }))},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
      plugins:{legend:{labels:{color:tick(),font:{size:11,family:"Inter"},boxWidth:12}},tooltip:tooltipDefaults()},
      scales:{x:{grid:{color:grid()},ticks:{color:tick(),font:{size:11}}},y:{grid:{color:grid()},ticks:{color:tick(),font:{size:10}}}}}});

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashSkills(cos) {
  const skills = analytics.skillDemandMatrix(cos);
  const p      = pal();

  const min=Math.min(...skills.map(s=>s.p25)), max=Math.max(...skills.map(s=>s.p75)), span=max-min||1;

  const html = `<div class="grid">
    ${panel("Salary P25–P75 Range","Interquartile salary range by skill. Hover for full detail.",`
      <div class="split-list">${skills.slice(0,10).map(s=>{
        const left=((s.p25-min)/span)*72, w=((s.p75-s.p25)/span)*72;
        return `<div class="rank-row" data-tip="${esc(s.skill)}\nP25: $${fmt(s.p25)}\nMedian: $${fmt(s.avgSalary)}\nP75: $${fmt(s.p75)}\nDemand: ${s.demand}">
          <strong>${esc(s.skill)}</strong>
          <div class="bar-track"><div class="bar-fill" style="margin-left:${left}%;width:${Math.max(5,w)}%;background:var(--coral)"></div></div>
          <span>$${fmt(s.avgSalary)}</span>
        </div>`;}).join("")}</div>`,5,"P25–P75")}
    ${panel("Skill Demand Ranking","Openings weighted by company hiring volume.",`
      <div class="chart" style="height:340px"><canvas id="skillDemandChart" style="height:340px"></canvas></div>`,7,"Open roles")}
    ${panel("Skill Family Breakdown","Demand grouped by skill category.",`
      <div class="chart" style="height:230px"><canvas id="skillFamilyChart" style="height:230px"></canvas></div>`,5,"By family")}
    ${panel("Skill Evolution Timeline","The market is shifting from prompt interfaces toward production AI governance.",`
      <table><thead><tr><th>Year</th><th>Dominant Skills</th><th>Signal</th></tr></thead>
      <tbody>${analytics.skillEvolution.map(r=>`<tr>
        <td><strong>${r.year}</strong></td>
        <td>${r.skills.map(esc).join(" · ")}</td>
        <td>${r.year<=2023?"Prompt era":r.year===2024?"RAG era":r.year===2025?"Agents era":"Governance era"}</td>
      </tr>`).join("")}</tbody></table>`,7,"2023–2026")}
  </div>`;

  setTimeout(()=>{
    const top=skills.slice(0,12);
    barChartH("skillDemandChart",top.map(s=>s.skill),top.map(s=>s.selectedDemand),p.slice(0,top.length).map(c=>c+"cc"),"Openings");

    // Family breakdown as doughnut
    const famMap=new Map();
    skills.forEach(s=>famMap.set(s.family,(famMap.get(s.family)||0)+s.selectedDemand));
    const fams=[...famMap.entries()].sort((a,b)=>b[1]-a[1]);
    doughnutChart("skillFamilyChart",fams.map(f=>f[0]),fams.map(f=>f[1]),p.slice(0,fams.length));

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashPredictor(cos) {
  const ranked = [...cos].sort((a,b)=>b.successProbability-a.successProbability);
  const focus  = ranked[0];
  const shap   = analytics.shapBreakdown(focus);
  const fi     = analytics.featureImportance();
  const p      = pal();
  const top3   = ranked.slice(0,3);

  const html = `<div class="grid">
    ${panel("Startup Success Score","ML logistic score for next funding round, acquisition, or unicorn trajectory.",`
      <div class="company-list">${ranked.map(c=>`
        <div class="company-card" data-tip="${esc(c.name)}\nSuccess: ${pct(c.successProbability)}\nIPO: ${pct(c.ipoReadiness)}\nRisk: ${pct(c.layoffRisk)}\nPMF: ${c.pmfScore}">
          <strong>${esc(c.name)}<span class="muted" style="font-weight:400"> · ${esc(c.stage)}</span></strong>
          <div class="metric-line"><span>Success probability</span><b>${pct(c.successProbability)}</b></div>
          <div class="bar-track"><div class="bar-fill" style="width:${c.successProbability}%"></div></div>
          <div class="metric-line"><span>IPO readiness · PMF score</span><b>${pct(c.ipoReadiness)} · ${c.pmfScore}</b></div>
        </div>`).join("")}`,5,"ML score")}
    ${panel("Multi-Dimensional Radar","Top 3 companies scored across 6 key dimensions.",`
      <div class="radar-wrap"><canvas id="radarChart"></canvas></div>`,4,"Radar")}
    ${panel("Feature Importance","XGBoost / Random Forest style importance ranking.",`
      <div class="chart" style="height:240px"><canvas id="featureChart" style="height:240px"></canvas></div>`,3,"Explainability")}
    ${panel(`SHAP Breakdown: ${focus?.name??"Top Company"}`,"Directional contribution to predicted success probability.",`
      <div class="split-list">${shap.map(r=>`
        <div class="rank-row" data-tip="${esc(r.factor)}\nContribution: ${r.value>0?"+":""}${r.value}">
          <strong>${esc(r.factor)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.abs(r.value)*2.4)}%;background:${r.value>=0?"var(--green)":"var(--coral)"}"></div></div>
          <span style="color:${r.value>=0?"var(--green)":"var(--coral)"};font-weight:700">${r.value>0?"+":""}${r.value}</span>
        </div>`).join("")}`,3,"SHAP")}
    ${panel("Advanced Metrics Table","Velocity, PMF, AI intensity, and funding efficiency by company.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Company</th><th>AI Intensity</th><th>PMF Score</th><th>Velocity Score</th><th>Funding Efficiency</th><th>Burn Rate $K/emp</th><th>Success</th></tr></thead>
        <tbody>${ranked.map(c=>`<tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${pct(c.aiIntensity)}</td>
          <td>${c.pmfScore}</td>
          <td>${c.velocityScore}</td>
          <td>${c.fundingEfficiency}</td>
          <td>$${fmt(c.burnRateProxy)}</td>
          <td><span class="health ${c.successProbability>=88?"Expansion":c.successProbability>=72?"Stable":"Contraction"}">${pct(c.successProbability)}</span></td>
        </tr>`).join("")}</tbody>
      </table></div>`,12,"All metrics")}
  </div>`;

  setTimeout(()=>{
    barChartH("featureChart",fi.map(f=>f.feature),fi.map(f=>f.importance*100),p.slice(0,fi.length).map(c=>c+"cc"),"Importance %");

    const normalize=(c,metric,allCos)=>{const vals=allCos.map(x=>x[metric]);const mn=Math.min(...vals),mx=Math.max(...vals);return Math.round(((c[metric]-mn)/(mx-mn||1))*100);};
    radarChart("radarChart",
      ["Hiring\nMomentum","Revenue\nGrowth","Market\nSignal","Product\nExpansion","Funding\nIntensity","PMF\nScore"],
      top3.map((c,i)=>({
        label:c.name,
        data:[normalize(c,"hiringMomentum",cos),normalize(c,"revenueGrowth",cos),normalize(c,"marketSignal",cos),normalize(c,"productExpansion",cos),normalize(c,"fundingTotal",cos),normalize(c,"pmfScore",cos)],
        borderColor:p[i%p.length],backgroundColor:alpha(p[i%p.length],.12),pointBackgroundColor:p[i%p.length],borderWidth:2
      })));

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashRisk(cos) {
  const risked = [...cos].sort((a,b)=>b.layoffRisk-a.layoffRisk);
  const p      = pal();

  const html = `<div class="grid">
    ${panel("Company Risk Table","Sorted by layoff risk. Hiring Momentum = current ÷ 6-month avg.",companyTable(risked),8,"Risk ranking")}
    ${panel("Layoff Risk Watch","Risk rises when hiring falls below trend and market signal weakens.",`
      <div class="company-list">${risked.slice(0,7).map(c=>`
        <div class="company-card" data-tip="${esc(c.name)}\nLayoff Risk: ${pct(c.layoffRisk)}\nMomentum: ${c.hiringMomentum}\nMarket Signal: ${c.marketSignal}">
          <strong>${esc(c.name)}</strong>
          <div class="metric-line"><span>Layoff risk</span><b style="color:var(--coral)">${pct(c.layoffRisk)}</b></div>
          <div class="bar-track"><div class="bar-fill" style="width:${c.layoffRisk}%;background:var(--coral)"></div></div>
          <div class="metric-line"><span>Momentum · Market signal</span><b>${c.hiringMomentum} · ${c.marketSignal}</b></div>
        </div>`).join("")}`,4,"Risk signal")}
    ${panel("Health Distribution","Expansion vs stable vs contraction — current filtered universe.",`
      <div class="chart" style="height:220px"><canvas id="healthDonut" style="height:220px"></canvas></div>`,4,"Breakdown")}
    ${panel("Risk Score Distribution","Histogram of layoff risk across the filtered universe.",`
      <div class="chart" style="height:220px"><canvas id="riskHistChart" style="height:220px"></canvas></div>`,4,"Histogram")}
    ${panel("Interpretation","",`<div class="insight">
      <strong>Momentum ≥ 1.2</strong> → Expansion &nbsp;·&nbsp;
      <strong>0.8–1.2</strong> → Stable &nbsp;·&nbsp;
      <strong>&lt; 0.8</strong> → Contraction<br><br>
      High risk clusters around momentum below 0.8 <em>and</em> market signal below 50.
      Companies with strong recent funding often suppress risk even if current momentum dips.
    </div>`,4)}
  </div>`;

  setTimeout(()=>{
    const hc={Expansion:0,Stable:0,Contraction:0};
    risked.forEach(c=>hc[c.health]++);
    doughnutChart("healthDonut",Object.keys(hc),Object.values(hc),[p[5],p[2],p[3]]);

    const buckets=[0,0,0,0,0];
    risked.forEach(c=>buckets[Math.min(4,Math.floor(c.layoffRisk/20))]++);
    destroyChart("riskHistChart");
    const ctx=document.getElementById("riskHistChart")?.getContext("2d");
    if(ctx) chartInstances["riskHistChart"]=new Chart(ctx,{type:"bar",data:{
      labels:["0–20%","20–40%","40–60%","60–80%","80–100%"],
      datasets:[{label:"Companies",data:buckets,backgroundColor:[p[5]+"cc",p[2]+"cc",p[2]+"cc",p[3]+"cc",p[3]+"cc"],borderRadius:5}]
    },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tooltipDefaults()},scales:{
      x:{grid:{display:false},ticks:{color:tick(),font:{size:11}}},
      y:{grid:{color:grid()},ticks:{color:tick(),font:{size:10},stepSize:1}}
    }}});

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashMarket(cos) {
  const conc  = analytics.marketConcentration(cos);
  const stage = analytics.stageIntelligence(cos);
  const p     = pal();
  const total = cos.reduce((s,c)=>s+c.currentAiJobs,0)||1;

  const html = `<div class="grid">
    ${panel("Market Concentration (HHI)",`Industry-level Herfindahl–Hirschman Index. Below 1500 = competitive, 1500–2500 = moderate, above 2500 = concentrated.`,`
      <div class="gauge-row">
        <div>
          <div class="gauge-num">${conc.hhi}</div>
          <div class="gauge-label">HHI Index</div>
        </div>
        <div class="split-list" style="flex:1">
          ${conc.shares.map(s=>`<div class="rank-row" data-tip="${esc(s.industry)}\nJobs: ${fmt(s.jobs)}\nShare: ${pct(s.share)}">
            <strong style="font-size:0.82rem">${esc(s.industry)}</strong>
            <div class="bar-track"><div class="bar-fill" style="width:${s.share}%;background:${p[conc.shares.indexOf(s)%p.length]}"></div></div>
            <span>${pct(s.share)}</span>
          </div>`).join("")}
        </div>
      </div>`,5,"Concentration")}
    ${panel("Industry Job Share","Proportional split of AI openings across industries.",`
      <div class="chart" style="height:260px"><canvas id="industryShareChart" style="height:260px"></canvas></div>`,4,"Doughnut")}
    ${panel("Company Dominance","Each company's share of total AI openings in the filtered universe.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Rank</th><th>Company</th><th>Industry</th><th>Jobs</th><th>Market Share</th><th>AI Intensity</th><th>Velocity</th></tr></thead>
        <tbody>${conc.companies.slice(0,12).map((c,i)=>{
          const full=cos.find(x=>x.name===c.name);
          return `<tr>
            <td><strong>#${i+1}</strong></td>
            <td><strong>${esc(c.name)}</strong></td>
            <td>${esc(c.industry)}</td>
            <td>${fmt(c.jobs)}</td>
            <td><div style="display:flex;align-items:center;gap:7px">${pct(c.share)}
              <div class="bar-track" style="width:60px;flex:0 0 60px"><div class="bar-fill" style="width:${c.share*3}%;background:${p[i%p.length]}"></div></div>
            </div></td>
            <td>${full?pct(full.aiIntensity):"—"}</td>
            <td>${full?full.velocityScore:"—"}</td>
          </tr>`;}).join("")}</tbody>
      </table></div>`,3,"Market share")}
    ${panel("AI Intensity Ranking","AI roles as % of total workforce — signals how AI-native each company is.",`
      <div class="chart" style="height:260px"><canvas id="intensityChart" style="height:260px"></canvas></div>`,4,"AI-native")}
    ${panel("Velocity Score Ranking","AI hiring growth normalized by company age — younger companies with higher scores move faster.",`
      <div class="chart" style="height:260px"><canvas id="velocityChart" style="height:260px"></canvas></div>`,4,"Velocity")}
    ${panel("Funding Efficiency","Revenue index per $100M of funding raised — capital effectiveness proxy.",`
      <div class="chart" style="height:260px"><canvas id="fundEffChart" style="height:260px"></canvas></div>`,4,"Capital efficiency")}
  </div>`;

  setTimeout(()=>{
    doughnutChart("industryShareChart",conc.shares.map(s=>s.industry),conc.shares.map(s=>s.jobs),p.slice(0,conc.shares.length));

    const byIntensity=[...cos].sort((a,b)=>b.aiIntensity-a.aiIntensity).slice(0,12);
    barChartH("intensityChart",byIntensity.map(c=>c.name),byIntensity.map(c=>c.aiIntensity),byIntensity.map((_,i)=>p[i%p.length]+"cc"),"AI Intensity %");

    const byVelocity=[...cos].sort((a,b)=>b.velocityScore-a.velocityScore).slice(0,12);
    barChartH("velocityChart",byVelocity.map(c=>c.name),byVelocity.map(c=>c.velocityScore),byVelocity.map((_,i)=>p[i%p.length]+"cc"),"Velocity Score");

    const byEff=[...cos].filter(c=>c.fundingEfficiency>0).sort((a,b)=>b.fundingEfficiency-a.fundingEfficiency).slice(0,12);
    barChartH("fundEffChart",byEff.map(c=>c.name),byEff.map(c=>c.fundingEfficiency),byEff.map((_,i)=>p[i%p.length]+"cc"),"Funding Efficiency");

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashCompensation(cos) {
  const sal = analytics.salaryIntelligence(cos);
  const p   = pal();
  const globalAvg = Math.round(cos.reduce((s,c)=>s+c.salaryMedian,0)/cos.length);

  const html = `<div class="grid">
    ${panel("Salary by Industry","Average, min, and max salary by industry. Wider bars = higher salary spread.",`
      <div class="chart" style="height:260px"><canvas id="salaryIndustryChart" style="height:260px"></canvas></div>`,7,"Industry bands")}
    ${panel("Remote Work Premium","Onsite companies pay more — but remote-friendly offers larger talent pools.",`
      ${metricsRow([{value:"$"+fmt(sal.onsiteAvg),label:"Onsite Avg"},{value:"$"+fmt(sal.remoteAvg),label:"Remote Avg"},{value:`+${sal.remotePremium}%`,label:"Onsite Premium"}])}
      <div class="chart" style="height:180px"><canvas id="remotePremChart" style="height:180px"></canvas></div>`,5,"Premium")}
    ${panel("Salary by Funding Stage","Later-stage companies command higher salaries — but not always.",`
      <div class="chart" style="height:220px"><canvas id="stageSalaryChart" style="height:220px"></canvas></div>`,6,"Stage")}
    ${panel("Top Paying Companies","Sorted by median compensation. Includes equity signals.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Company</th><th>Median Salary</th><th>vs Avg</th><th>Remote</th><th>Stage</th><th>Industry</th></tr></thead>
        <tbody>${sal.topCompanies.map(c=>{
          const delta=c.salary-globalAvg, sign=delta>=0?"+":"";
          return `<tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td>$${fmt(c.salary)}</td>
            <td style="color:${delta>=0?"var(--green)":"var(--coral)"};font-weight:700">${sign}$${fmt(Math.abs(delta))}</td>
            <td>${pct(c.remote)}</td>
            <td>${esc(c.stage)}</td>
            <td>${esc(c.industry)}</td>
          </tr>`;}).join("")}</tbody>
      </table></div>`,6,"Top 10")}
    ${panel("Geographic Salary Intelligence","Salary benchmarks across global AI hiring hubs.",`
      <div class="chart" style="height:260px"><canvas id="geoSalaryChart" style="height:260px"></canvas></div>`,12,"Global")}
  </div>`;

  setTimeout(()=>{
    barChartH("salaryIndustryChart",sal.byIndustry.map(s=>s.industry),sal.byIndustry.map(s=>s.avg),sal.byIndustry.map((_,i)=>p[i%p.length]+"cc"),"Avg Salary $");

    destroyChart("remotePremChart");
    const ctx2=document.getElementById("remotePremChart")?.getContext("2d");
    if(ctx2) chartInstances["remotePremChart"]=new Chart(ctx2,{type:"bar",data:{
      labels:["Remote ≥50%","Onsite <30%"],
      datasets:[{label:"Avg Salary",data:[sal.remoteAvg,sal.onsiteAvg],backgroundColor:[p[0]+"cc",p[1]+"cc"],borderRadius:6,borderSkipped:false}]
    },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tooltipDefaults()},scales:{
      x:{grid:{display:false},ticks:{color:tick(),font:{size:11}}},
      y:{grid:{color:grid()},ticks:{color:tick(),font:{size:10},callback:v=>"$"+fmt(v)}}
    }}});

    barChartH("stageSalaryChart",sal.byStage.map(s=>s.stage),sal.byStage.map(s=>s.avg),sal.byStage.map((_,i)=>p[i%p.length]+"cc"),"Avg Salary $");

    const geos=[...analytics.geoScores].sort((a,b)=>b.salary-a.salary);
    barChartH("geoSalaryChart",geos.map(h=>h.city),geos.map(h=>h.salary),geos.map((_,i)=>p[i%p.length]+"cc"),"Median Salary $");

    bindTips(el.dashboard);
  },0);
  return html;
}

function dashModels() {
  return `<div class="grid">
    ${panel("Scraping & API Collection","Production-ready source plan for live data depth.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Source</th><th>Entity</th><th>Cadence</th><th>Fields</th></tr></thead>
        <tbody>${analytics.scrapeTargets.map(t=>`<tr>
          <td><strong>${esc(t.source)}</strong></td><td>${esc(t.entity)}</td><td>${esc(t.cadence)}</td><td>${esc(t.fields)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`,7,"ETL sources")}
    ${panel("Model & Graph Roadmap","What to build next to make this look senior-analytics-lead quality.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Model</th><th>Target</th><th>Best Graph</th><th>Features</th></tr></thead>
        <tbody>${analytics.modelRoadmap().map(r=>`<tr>
          <td><strong>${esc(r.model)}</strong></td><td>${esc(r.target)}</td><td>${esc(r.graph)}</td><td>${esc(r.features)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`,5,"Roadmap")}
    ${panel("Production Architecture","",`
      <div class="table-wrap"><table><tbody>
        <tr><th style="width:140px">Collection</th><td>Job APIs (Greenhouse, Lever), LinkedIn datasets, Crunchbase, SEC EDGAR, YC data, earnings reports</td></tr>
        <tr><th>Processing</th><td>Python, SQL, Airflow, dbt, data quality checks, slowly changing dimensions</td></tr>
        <tr><th>Warehouse</th><td>Snowflake star schema — company, job, funding, skill, geography, time dimensions</td></tr>
        <tr><th>Analytics</th><td>Forecasting, clustering, classification, SHAP, cohort curves, network analysis, radar scoring</td></tr>
        <tr><th>BI & Output</th><td>Tableau, Power BI, Plotly Dash, executive PDF exports, Slack alert monitors</td></tr>
      </tbody></table></div>`,12,"Stack")}
  </div>`;
}

function dashAdvanced(cos) {
  return `<div class="grid">
    ${panel("Talent Migration Network","Track movement from major labs and platforms into AI challengers.",svgSankey(analytics.talentFlows),7,"Network")}
    ${panel("Cohort Analysis","Grouped by founding era, sector, and company maturity.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Cohort</th><th>M0</th><th>M6</th><th>M12</th><th>M18</th><th>M24</th><th>Growth</th></tr></thead>
        <tbody>${analytics.cohorts.map(r=>`<tr>
          <td><strong>${esc(r.cohort)}</strong></td>
          <td>${r.month0}</td><td>${r.month6}</td><td>${r.month12}</td><td>${r.month18}</td>
          <td><strong>${r.month24}</strong></td>
          <td style="color:var(--green);font-weight:700">+${pct((r.month24-r.month0)/r.month0*100)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`,5,"Cohorts")}
    ${panel("Full Company Universe","All 22 companies — every computed metric.",`
      <div class="table-wrap"><table>
        <thead><tr><th>Company</th><th>Founded</th><th>Employees</th><th>Salary</th><th>Remote</th><th>AI Intensity</th><th>PMF</th><th>Stage</th><th>Industry</th></tr></thead>
        <tbody>${[...analytics.companyScores].sort((a,b)=>b.employees-a.employees).map(c=>`<tr>
          <td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.hq)}</span></td>
          <td>${c.founded}</td>
          <td>${fmt(c.employees)}</td>
          <td>$${fmt(c.salaryMedian)}</td>
          <td>${pct(c.remoteShare)}</td>
          <td>${pct(c.aiIntensity)}</td>
          <td>${c.pmfScore}</td>
          <td>${esc(c.stage)}</td>
          <td>${esc(c.industry)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`,12,"22 companies")}
  </div>`;
}

/* ─── Main render ────────────────────────────────────────────── */
function renderDashboard() {
  Object.keys(chartInstances).forEach(id=>destroyChart(id));
  const cos = filteredCompanies();
  renderTabs();
  renderKpis(cos);
  el.riskLabel.textContent = `${state.minSuccess}%`;

  if(!cos.length) {
    el.dashboard.innerHTML=`<div class="empty">No companies match the current filters. Lower the success threshold or broaden the filters.</div>`;
    return;
  }

  const renderers = {
    liveintel:    dashLiveIntel,
    landscape:    dashLandscape,
    geo:          dashGeo,
    funding:      dashFunding,
    growth:       dashGrowth,
    skills:       dashSkills,
    predictor:    dashPredictor,
    risk:         dashRisk,
    market:       dashMarket,
    compensation: dashCompensation,
    models:       dashModels,
    advanced:     dashAdvanced
  };
  el.dashboard.innerHTML = renderers[state.tab](cos);
  bindTips(el.dashboard);
}

/* ─── Events ─────────────────────────────────────────────────── */
function bindEvents() {
  el.tabs.addEventListener("click", e => {
    const b=e.target.closest("[data-tab]"); if(!b) return;
    state.tab=b.dataset.tab; renderDashboard();
  });
  el.industry.addEventListener("change", ()=>{state.industry=el.industry.value; renderDashboard();});
  el.stage.addEventListener("change",    ()=>{state.stage=el.stage.value;       renderDashboard();});
  el.search.addEventListener("input",    ()=>{state.search=el.search.value;     renderDashboard();});
  el.risk.addEventListener("input",      ()=>{state.minSuccess=Number(el.risk.value); renderDashboard();});
  el.themeToggle.addEventListener("click",()=>{state.dark=!state.dark; applyTheme(); renderDashboard();});
  el.exportBtn.addEventListener("click", exportCSV);
}

/* ─── Init ───────────────────────────────────────────────────── */
populateControls();
bindEvents();
initTicker();
renderDashboard();
