/**
 * CLARIVANA — BIOTECH FEATURES MODULE
 * Drop-in addition for: Toxicity Scoring, Body System Impact Map, Cumulative Exposure Tracker
 * Add <script src="clarivana-biotech.js"></script> before </body> in index.html
 * Add <link rel="stylesheet" href="clarivana-biotech.css"> in <head>
 */

// ─────────────────────────────────────────────
// TOXICITY SCORE ENGINE
// Maps ingredient disease strings → severity scores
// ─────────────────────────────────────────────
const TOXICITY_KEYWORDS = {
  carcinogen:       30,
  cancer:           28,
  tumor:            25,
  "hormone disrupt": 22,
  "endocrine":      22,
  "reproductive":   20,
  "neurotox":       20,
  "liver damage":   18,
  "kidney":         16,
  "banned":         20,
  "heart disease":  16,
  "alzheimer":      18,
  "lung disease":   16,
  "asthma":         14,
  "hyperactivity":  12,
  "allergic":       10,
  "irritat":        8,
  "digestive":      6,
  "blood sugar":    8,
  "obesity":        10,
  "toxic":          18,
  "may cause":      4,
};

// Body system tags based on disease keywords
const SYSTEM_KEYWORDS = {
  liver:       ["liver", "hepat"],
  kidneys:     ["kidney", "renal"],
  brain:       ["neurotox", "alzheimer", "headache", "nerve", "neurolog"],
  lungs:       ["lung", "respirat", "asthma", "airway"],
  heart:       ["heart", "cardiovascular", "cholesterol", "arrhythmia"],
  gut:         ["digestive", "gut", "diarrhea", "bowel", "intestin", "stomach", "microbiome"],
  hormones:    ["hormone", "endocrine", "estrogen", "thyroid", "reproductive"],
  skin:        ["skin", "irritat", "topical", "dermat"],
  blood:       ["blood sugar", "insulin", "glucose", "diabetes", "metabolic"],
  immune:      ["allergic", "allerg", "immune", "hyperactivity"],
};

function scoreIngredient(diseases) {
  if (!diseases || diseases.length === 0) return 0;
  let score = 0;
  const text = diseases.join(" ").toLowerCase();
  for (const [kw, val] of Object.entries(TOXICITY_KEYWORDS)) {
    if (text.includes(kw)) score += val;
  }
  return Math.min(score, 100);
}

function getSystemsAffected(diseases) {
  if (!diseases || diseases.length === 0) return [];
  const text = diseases.join(" ").toLowerCase();
  const affected = [];
  for (const [system, keywords] of Object.entries(SYSTEM_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) affected.push(system);
  }
  return affected;
}

function getRiskLabel(score) {
  if (score >= 40) return { label: "HIGH RISK",   color: "#E24B4A", grade: "D" };
  if (score >= 20) return { label: "MODERATE",    color: "#EF9F27", grade: "C" };
  if (score >= 8)  return { label: "LOW CONCERN", color: "#A8C76B", grade: "B" };
  return              { label: "SAFE",          color: "#1D9E75", grade: "A" };
}

// ─────────────────────────────────────────────
// EXPOSURE TRACKER (localStorage)
// ─────────────────────────────────────────────
const EXPOSURE_KEY = "clarivana_exposure_log";

function logExposure(ingredientName, score) {
  const log = JSON.parse(localStorage.getItem(EXPOSURE_KEY) || "{}");
  if (!log[ingredientName]) log[ingredientName] = { count: 0, totalScore: 0, lastSeen: null };
  log[ingredientName].count++;
  log[ingredientName].totalScore = Math.max(log[ingredientName].totalScore, score);
  log[ingredientName].lastSeen = new Date().toISOString();
  localStorage.setItem(EXPOSURE_KEY, JSON.stringify(log));
}

function getExposureLog() {
  return JSON.parse(localStorage.getItem(EXPOSURE_KEY) || "{}");
}

function clearExposureLog() {
  localStorage.removeItem(EXPOSURE_KEY);
}

function getExposureInsights() {
  const log = getExposureLog();
  const entries = Object.entries(log).sort((a, b) => b[1].count - a[1].count);
  const total = entries.reduce((s, [, v]) => s + v.count, 0);
  const highRisk = entries.filter(([, v]) => v.totalScore >= 40);
  return { entries, total, highRisk };
}

// ─────────────────────────────────────────────
// MAIN ANALYSIS FUNCTION
// Call this after OCR/text extraction instead of (or alongside) existing AI analysis
// ─────────────────────────────────────────────
window.ClarivanaAnalyze = async function(rawText, ingredientsDB) {
  // ingredientsDB = the harmfulIngredients object from ingredients.json
  const words = rawText.toLowerCase().split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
  const results = [];
  let productScore = 0;
  const productSystems = new Set();

  for (const word of words) {
    const matched = Object.entries(ingredientsDB).find(([key]) =>
      word.includes(key.toLowerCase()) || key.toLowerCase().includes(word)
    );
    if (matched) {
      const [name, data] = matched;
      const score = scoreIngredient(data.diseases);
      const systems = getSystemsAffected(data.diseases);
      const risk = getRiskLabel(score);
      systems.forEach(s => productSystems.add(s));
      productScore = Math.max(productScore, score);
      logExposure(name, score);
      results.push({ name, diseases: data.diseases, score, systems, risk });
    }
  }

  results.sort((a, b) => b.score - a.score);
  const overallRisk = getRiskLabel(productScore);

  return {
    ingredients: results,
    productScore,
    overallRisk,
    systemsAffected: Array.from(productSystems),
    exposureInsights: getExposureInsights(),
  };
};

// ─────────────────────────────────────────────
// UI RENDERER
// Injects the biotech UI into existing #ai-result box
// ─────────────────────────────────────────────
window.ClarivanaRenderResults = function(analysis, containerEl) {
  const { ingredients, productScore, overallRisk, systemsAffected, exposureInsights } = analysis;

  containerEl.innerHTML = `
    <div class="cv-biotech-panel">

      <!-- HEADER SCORE -->
      <div class="cv-score-header" style="border-color:${overallRisk.color}">
        <div class="cv-score-left">
          <div class="cv-grade" style="background:${overallRisk.color}">${overallRisk.grade}</div>
          <div>
            <div class="cv-product-risk" style="color:${overallRisk.color}">${overallRisk.label}</div>
            <div class="cv-product-sub">Biocompatibility Score: ${productScore}/100</div>
          </div>
        </div>
        <div class="cv-score-bar-wrap">
          <div class="cv-score-bar">
            <div class="cv-score-fill" style="width:${productScore}%;background:${overallRisk.color}"></div>
          </div>
          <div class="cv-score-ticks">
            <span>SAFE</span><span>CAUTION</span><span>DANGER</span>
          </div>
        </div>
      </div>

      <!-- BODY SYSTEM MAP -->
      ${systemsAffected.length > 0 ? `
      <div class="cv-section">
        <div class="cv-section-title">⚗ Body Systems Affected</div>
        <div class="cv-body-map">
          ${renderBodyMap(systemsAffected)}
        </div>
        <div class="cv-systems-list">
          ${systemsAffected.map(s => `<span class="cv-system-tag">${s.toUpperCase()}</span>`).join("")}
        </div>
      </div>` : ""}

      <!-- INGREDIENT LIST -->
      <div class="cv-section">
        <div class="cv-section-title">🔬 Ingredient Breakdown</div>
        ${ingredients.length === 0
          ? `<div class="cv-clean">✅ No flagged ingredients detected. This product appears clean.</div>`
          : ingredients.map(ing => `
          <div class="cv-ing-card" style="border-left-color:${ing.risk.color}">
            <div class="cv-ing-top">
              <div class="cv-ing-name">${ing.name}</div>
              <div class="cv-ing-score" style="color:${ing.risk.color}">${ing.score}<span>/100</span></div>
            </div>
            <div class="cv-ing-risk" style="color:${ing.risk.color}">${ing.risk.label}</div>
            <div class="cv-ing-effects">
              ${ing.diseases.map(d => `<div class="cv-effect">• ${d}</div>`).join("")}
            </div>
            ${ing.systems.length > 0 ? `
            <div class="cv-ing-systems">
              ${ing.systems.map(s => `<span class="cv-sys-badge">${s}</span>`).join("")}
            </div>` : ""}
          </div>
        `).join("")}
      </div>

      <!-- CUMULATIVE EXPOSURE TRACKER -->
      <div class="cv-section">
        <div class="cv-section-title">📊 Cumulative Exposure Tracker</div>
        ${renderExposureTracker(exposureInsights)}
        <button class="cv-clear-btn" onclick="clearExposureLog(); window.ClarivanaRenderResults(window._lastAnalysis, document.querySelector('.cv-biotech-panel').parentElement)">
          Reset Tracker
        </button>
      </div>

    </div>
  `;

  // Store for reset re-render
  window._lastAnalysis = analysis;
};

function renderBodyMap(affected) {
  const SYSTEM_KEYWORDS = {
  liver:    ["liver", "hepat", "fatty liver", "hepatocellular", "cirrhosis", "nafld", "hepatotoxic"],
  kidneys:  ["kidney", "renal", "nephro", "kidney stone", "kidney disease", "kidney failure", "urinary", "bladder"],
  brain:    ["neurotox", "alzheimer", "headache", "nerve", "neurolog", "behavioral", "behaviour", "hyperactivity", "attention", "adhd", "cognitive", "memory", "dizziness", "mood", "anxiety", "depression", "neuropathy", "brain", "neurodevelop", "iq", "intelligence"],
  lungs:    ["lung", "respirat", "asthma", "airway", "bronch", "pulmonary", "popcorn lung", "obliterative", "inhalation", "respiratory", "wheez"],
  heart:    ["heart", "cardiovascular", "cholesterol", "arrhythmia", "cardiac", "coronary", "ldl", "hdl", "triglyceride", "blood pressure", "hypertension", "atherosclerosis"],
  gut:      ["digestive", "gut", "diarrhea", "bowel", "intestin", "stomach", "microbiome", "colon", "colorectal", "gastro", "nausea", "vomit", "ibs", "colitis", "microbiota", "bloat", "cramp", "ulcer", "rectal"],
  hormones: ["hormone", "endocrine", "estrogen", "thyroid", "reproductive", "fertility", "sperm", "testosterone", "iodine", "estrogenic", "disrupt", "paraben", "puberty", "menstrual"],
  skin:     ["skin", "irritat", "topical", "dermat", "rash", "hive", "urticaria", "eczema", "contact", "sensitiz", "acne"],
  blood:    ["blood sugar", "insulin", "glucose", "diabetes", "metabolic", "glycem", "triglyceride", "uric acid", "gout", "anemia", "methemoglobin", "oxygen", "hemoglobin", "ldl", "hdl"],
  immune:   ["allergic", "allerg", "immune", "hyperactivity", "anaphylax", "sensitiv", "autoimmun", "inflammatory", "inflammation", "cytokine", "histamine", "cancer", "carcinogen", "tumor", "carcinoma", "leukemia", "genotox", "mutagenic", "dna damage"],
};
  const ALL_SYSTEMS = [
    { id: "brain",    label: "Brain",    cx: 100, cy: 38,  r: 22 },
    { id: "lungs",    label: "Lungs",    cx: 100, cy: 95,  r: 18 },
    { id: "heart",    label: "Heart",    cx: 72,  cy: 95,  r: 14 },
    { id: "liver",    label: "Liver",    cx: 130, cy: 108, r: 14 },
    { id: "gut",      label: "Gut",      cx: 100, cy: 135, r: 16 },
    { id: "kidneys",  label: "Kidneys",  cx: 68,  cy: 130, r: 12 },
    { id: "hormones", label: "Hormones", cx: 132, cy: 130, r: 12 },
    { id: "skin",     label: "Skin",     cx: 45,  cy: 80,  r: 10 },
    { id: "blood",    label: "Blood",    cx: 155, cy: 80,  r: 10 },
    { id: "immune",   label: "Immune",   cx: 100, cy: 170, r: 10 },
  ];
  const svgParts = ALL_SYSTEMS.map(sys => {
    const isAffected = affected.includes(sys.id);
    const fill = isAffected ? "#E24B4A" : "rgba(255,255,255,0.05)";
    const stroke = isAffected ? "#E24B4A" : "rgba(255,255,255,0.15)";
    const glow = isAffected ? `filter:drop-shadow(0 0 6px #E24B4A88)` : "";
    return `
      <g style="${glow}">
        <circle cx="${sys.cx}" cy="${sys.cy}" r="${sys.r}"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5"
          ${isAffected ? 'class="cv-organ-pulse"' : ""}/>
        <text x="${sys.cx}" y="${sys.cy + 4}" text-anchor="middle"
          font-size="7" fill="${isAffected ? "#fff" : "rgba(255,255,255,0.3)"}"
          font-family="monospace">${sys.label}</text>
      </g>`;
  });

  // Body outline
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="cv-body-svg">
    <!-- Body silhouette -->
    <ellipse cx="100" cy="20" rx="16" ry="18" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <path d="M84 36 Q70 50 68 80 Q66 120 70 160 Q80 175 100 178 Q120 175 130 160 Q134 120 132 80 Q130 50 116 36"
      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <path d="M68 55 Q50 58 44 80 Q42 95 50 100 Q58 105 68 95"
      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <path d="M132 55 Q150 58 156 80 Q158 95 150 100 Q142 105 132 95"
      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    ${svgParts.join("")}
  </svg>`;
}

function renderExposureTracker(insights) {
  const { entries, total, highRisk } = insights;
  if (entries.length === 0) {
    return `<div class="cv-exposure-empty">No exposure history yet. Scan more products to track patterns.</div>`;
  }

  const topEntries = entries.slice(0, 6);
  const maxCount = topEntries[0]?.[1].count || 1;

  return `
    <div class="cv-exposure-summary">
      <div class="cv-exp-stat">
        <div class="cv-exp-num">${total}</div>
        <div class="cv-exp-label">Total Exposures Logged</div>
      </div>
      <div class="cv-exp-stat ${highRisk.length > 0 ? "cv-exp-danger" : ""}">
        <div class="cv-exp-num" style="${highRisk.length > 0 ? "color:#E24B4A" : ""}">${highRisk.length}</div>
        <div class="cv-exp-label">High-Risk Ingredients Repeated</div>
      </div>
    </div>
    ${highRisk.length > 0 ? `
    <div class="cv-exposure-warning">
      ⚠ You keep encountering: ${highRisk.slice(0, 3).map(([n]) => `<strong>${n}</strong>`).join(", ")}
      — these are accumulating across your scanned products.
    </div>` : ""}
    <div class="cv-exposure-bars">
      ${topEntries.map(([name, data]) => {
        const pct = (data.count / maxCount) * 100;
        const risk = getRiskLabel(data.totalScore);
        return `
        <div class="cv-exp-row">
          <div class="cv-exp-name">${name}</div>
          <div class="cv-exp-bar-wrap">
            <div class="cv-exp-bar-fill" style="width:${pct}%;background:${risk.color}"></div>
          </div>
          <div class="cv-exp-count" style="color:${risk.color}">${data.count}x</div>
        </div>`;
      }).join("")}
    </div>
  `;
}