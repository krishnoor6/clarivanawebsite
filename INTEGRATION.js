document.getElementById("ai-button").addEventListener("click", async () => {
  const text = document.getElementById("extracted-text").value;
  if (!text.trim()) return;

  const aiResult = document.getElementById("ai-result");
  const aiOutput = document.getElementById("ai-output");

  aiResult.style.display = "block";
  aiOutput.innerHTML = `<div style="text-align:center;padding:20px;opacity:0.5;font-size:12px;letter-spacing:2px">
    RUNNING BIOCHEMICAL ANALYSIS...
  </div>`;

  // Load ingredients DB (already fetched in your app, pass it here)
  // If you already have it in a variable called `ingredientsData`, use that
  let db;
  try {
    const res = await fetch("./ingredients.json");
    const json = await res.json();
    db = json.harmfulIngredients;
  } catch (e) {
    aiOutput.innerHTML = "Failed to load ingredient database.";
    return;
  }

  // Run the analysis
  const analysis = await window.ClarivanaAnalyze(text, db);

  // Render into the ai-result container
  window.ClarivanaRenderResults(analysis, aiOutput);

  // Still save to history as before (keep your existing save logic)
});


/* ══════════════════════════════════════════════════════════
   HOW EACH FEATURE WORKS
   ══════════════════════════════════════════════════════════

1. TOXICITY SCORING ENGINE
   ─────────────────────────
   - Each ingredient's disease strings are scanned for ~20 severity keywords
   - Keywords like "carcinogen" (+30), "cancer" (+28), "hormone disrupt" (+22)
     down to "digestive" (+6), "allergic" (+10)
   - Score is capped at 100, mapped to A/B/C/D grade
   - Product gets the MAX score of its worst ingredient
   - Displayed as a live progress bar with grade badge

2. BODY SYSTEM IMPACT MAP
   ──────────────────────────
   - Ingredient disease text is matched against 10 body system keyword groups:
     liver, kidneys, brain, lungs, heart, gut, hormones, skin, blood, immune
   - SVG body diagram: affected organs glow red + pulse animation
   - Safe organs shown as dim outlines
   - System tags listed below the diagram

3. CUMULATIVE EXPOSURE TRACKER
   ─────────────────────────────
   - Every time you run an analysis, flagged ingredients are logged to localStorage
   - Tracks: how many times each ingredient appeared, worst score seen, last scan date
   - Shows: total exposure count, number of high-risk repeats
   - Warning banner if a high-risk ingredient appears 2+ times
   - Bar chart of most-encountered ingredients
   - "Reset Tracker" button to clear history

   PITCH LINE FOR JUDGES:
   "This is the only consumer tool that doesn't just tell you what's in ONE product —
    it tells you what chemicals keep showing up across everything you eat."

══════════════════════════════════════════════════════════ */
