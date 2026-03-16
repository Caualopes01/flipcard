import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { searchOpportunities }    from "./services/mercadolivre.js";
import { fetchMYPListings }       from "./services/mypcards.js";
import { scrapeOLXListings }      from "./services/manus.js";
import { getDemand }              from "./services/demand.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Status ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "CardFlip API online", version: "2.0.0" }));

app.get("/api/status", (req, res) => {
  res.json({
    sources: {
      mercadolivre: !!process.env.ML_CLIENT_ID,
      mypcards:     true,        // pública, sem key
      olx:          !!process.env.MANUS_API_KEY,
      instagram:    !!process.env.MANUS_API_KEY,
      facebook:     !!process.env.MANUS_API_KEY,
    },
    manus:   !!process.env.MANUS_API_KEY,
    version: "2.0.0",
  });
});

// ── OAuth callback ML ─────────────────────────────────────────────────────────
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Code não recebido" });
  try {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        client_id:     process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code,
        redirect_uri:  process.env.ML_REDIRECT_URI,
      }),
    });
    const data = await response.json();
    res.json({ message: "Token obtido", access_token: data.access_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Oportunidades (todas as fontes agregadas) ─────────────────────────────────
app.get("/api/opportunities", async (req, res) => {
  const { category = "all", limit = 20, sources = "all" } = req.query;
  const lim = parseInt(limit);

  try {
    // Busca em paralelo: ML + MYP + OLX (via Manus)
    const [mlResults, mypResults, olxResults] = await Promise.allSettled([
      searchOpportunities(category, lim),
      fetchMYPListings(category, lim),
      process.env.MANUS_API_KEY ? scrapeOLXListings(category) : Promise.resolve([]),
    ]);

    const all = [
      ...(mlResults.status  === "fulfilled" ? mlResults.value  : []),
      ...(mypResults.status === "fulfilled" ? mypResults.value : []),
      ...(olxResults.status === "fulfilled" ? olxResults.value : []),
    ];

    // Filtra por fonte se solicitado
    const filtered = sources === "all"
      ? all
      : all.filter(item => item.platform.toLowerCase() === sources.toLowerCase());

    // Ordena por score e remove duplicatas por nome similar
    const sorted = deduplicateByName(filtered).sort((a, b) => b.score - a.score).slice(0, lim);

    res.json({ success: true, total: sorted.length, sources: getActiveSources(), data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Demanda (compradores) ─────────────────────────────────────────────────────
app.get("/api/demand", async (req, res) => {
  const { query = "" } = req.query;
  try {
    const buyers = await getDemand(query);
    res.json({ success: true, total: buyers.length, data: buyers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Busca por carta específica ────────────────────────────────────────────────
app.get("/api/search", async (req, res) => {
  const { q, game } = req.query;
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório" });

  try {
    const [opps, buyers] = await Promise.allSettled([
      searchOpportunities(game || "all", 10),
      getDemand(q),
    ]);

    const results = (opps.status === "fulfilled" ? opps.value : [])
      .filter(item => item.name.toLowerCase().includes(q.toLowerCase()));

    res.json({
      success: true,
      query: q,
      opportunities: results,
      buyers: buyers.status === "fulfilled" ? buyers.value : [],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function deduplicateByName(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.name.toLowerCase().slice(0, 30);
    if (!seen.has(key) || seen.get(key).score < item.score) seen.set(key, item);
  }
  return Array.from(seen.values());
}

function getActiveSources() {
  const s = { ML: !!process.env.ML_CLIENT_ID, MYP: true };
  if (process.env.MANUS_API_KEY) { s.OLX = true; s.Instagram = true; s.Facebook = true; }
  return s;
}

const PORT = process.env.PORT || 7860; // HuggingFace Spaces exige porta 7860
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🃏 CardFlip API v2.0 rodando na porta ${PORT}`);
  console.log(`   ML:        ${process.env.ML_CLIENT_ID ? "✅" : "❌"}`);
  console.log(`   MYP Cards: ✅ (pública)`);
  console.log(`   Manus:     ${process.env.MANUS_API_KEY ? "✅ (OLX + Instagram + Facebook)" : "❌"}\n`);
});
