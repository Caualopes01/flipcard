import { getMarketPrice } from "./prices.js";

let _token = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  try {
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
      }),
    });
    if (!res.ok) { console.error("[ML] Erro token:", await res.text()); return null; }
    const data = await res.json();
    _token = data.access_token;
    _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    console.log("[ML] Token obtido com sucesso");
    return _token;
  } catch (err) {
    console.error("[ML] Token exception:", err.message);
    return null;
  }
}

const SEARCH_QUERIES = {
  all:      ["carta pokemon vmax rare", "magic the gathering reserved", "one piece card sec", "dragon ball super card sp"],
  pokemon:  ["carta pokemon vmax secret rare", "pokemon psa graded", "charizard vmax rainbow"],
  magic:    ["magic reserved list", "magic dual land", "magic force of will"],
  onepiece: ["one piece card game sec op01", "one piece luffy sec"],
  dragon:   ["dragon ball super card sp", "dragon ball fusion world sr"],
};

function detectType(query) {
  if (query.includes("pokemon"))     return "pokemon";
  if (query.includes("magic"))       return "magic";
  if (query.includes("one piece"))   return "onepiece";
  if (query.includes("dragon ball")) return "dragon";
  return "pokemon";
}

function calcScore(price, marketPrice, sold, views) {
  if (!marketPrice || marketPrice <= price) return 0;
  const discount      = (marketPrice - price) / marketPrice;
  const discountScore = Math.min(discount * 150, 60);
  const demandScore   = Math.min((views / 80) + (sold * 3), 25);
  return Math.min(Math.round(discountScore + demandScore + 15), 99);
}

export async function searchOpportunities(category = "all", limit = 20) {
  const queries = SEARCH_QUERIES[category] || SEARCH_QUERIES.all;
  const token   = await getAccessToken();
  const results = [];

  for (const query of queries.slice(0, 3)) {
    try {
      const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=12&condition=used`;
      const res = await fetch(url, {
        headers: { "User-Agent": "CardFlip/1.0", ...(token && { Authorization: `Bearer ${token}` }) },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { console.warn(`[ML] HTTP ${res.status}`); continue; }

      const items = (await res.json()).results || [];

      for (const item of items) {
        const price       = item.price;
        const type        = detectType(query);
        const marketPrice = await getMarketPrice(item.title, type);

        if (!marketPrice || price >= marketPrice * 0.92) continue;

        const score = calcScore(price, marketPrice, item.sold_quantity || 0, item.visits || 0);
        if (score < 40) continue;

        results.push({
          id: item.id, type,
          name:      item.title,
          set:       item.condition === "used" ? "Usado" : "Novo",
          price, market: marketPrice, score,
          platform:  "ML",
          url:       item.permalink,
          thumbnail: item.thumbnail,
          location:  item.address?.city_name || "Brasil",
          buyers:    [],
          tier:      score >= 80 ? "hot" : score >= 65 ? "good" : "ok",
          qty:       item.available_quantity || 1,
        });
      }
    } catch (err) {
      console.error(`[ML] Erro "${query}":`, err.message);
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
