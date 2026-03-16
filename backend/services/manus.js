/**
 * Manus Agent Service
 * Vasculha fontes sem API: Instagram, OLX, Facebook Grupos, Telegram
 */

const MANUS_API = "https://api.manus.ai/v1";
const TIMEOUT_MS = 180_000;

const cache = new Map();
const CACHE_TTL = 20 * 60 * 1000;

function getCached(key) {
  const e = cache.get(key);
  if (!e || Date.now() > e.expiresAt) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runManusTask(prompt) {
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) throw new Error("MANUS_API_KEY não configurada");

  const createRes = await fetch(`${MANUS_API}/tasks`, {
    method: "POST",
    headers: { "accept": "application/json", "content-type": "application/json", "API_KEY": apiKey },
    body: JSON.stringify({ prompt }),
  });

  if (!createRes.ok) throw new Error(`Manus create: ${await createRes.text()}`);
  const { id: taskId } = await createRes.json();
  console.log(`[Manus] Task criada: ${taskId}`);

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await sleep(5000);
    const poll = await fetch(`${MANUS_API}/tasks/${taskId}`, { headers: { "API_KEY": apiKey } });
    if (!poll.ok) continue;
    const result = await poll.json();
    console.log(`[Manus] Status: ${result.status}`);
    if (result.status === "completed") return result;
    if (result.status === "failed") throw new Error("Manus task falhou");
  }
  throw new Error("Manus timeout");
}

function extractJSON(text) {
  try {
    const m = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (m) return JSON.parse(m[1]);
    const m2 = text.match(/\[[\s\S]*\]/);
    if (m2) return JSON.parse(m2[0]);
    return JSON.parse(text);
  } catch { return null; }
}

async function runManusAndParse(cacheKey, prompt, normalizer, fallback) {
  try {
    const result = await runManusTask(prompt);
    const output = result.output || result.result || JSON.stringify(result);
    const parsed = extractJSON(output);
    if (!parsed || !Array.isArray(parsed)) return fallback;
    const normalized = parsed.map(normalizer).filter(Boolean);
    if (normalized.length > 0) setCache(cacheKey, normalized);
    console.log(`[Manus] ${normalized.length} itens extraídos`);
    return normalized;
  } catch (err) {
    console.error("[Manus] Erro:", err.message);
    return fallback;
  }
}

// ── Instagram buyers ──────────────────────────────────────────────────────────
export async function scrapeInstagramBuyers(cardTypes = ["pokemon","magic","onepiece","dragon"]) {
  const cacheKey = `ig_buyers_${cardTypes.sort().join("_")}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const hashtags = buildHashtags(cardTypes);
  const prompt = `Acesse o Instagram e pesquise posts recentes (últimos 7 dias) com as hashtags: ${hashtags.join(", ")}. Identifique APENAS perfis procurando COMPRAR cartas (palavras: "procuro","quero comprar","WTB","busco","alguém vende","preciso de"). Ignore vendedores. Retorne JSON array com até 10:\n\`\`\`json\n[{"handle":"@usuario","initials":"XX","wants":["carta1","carta2"],"budget":300,"lastActive":"2h atrás","location":"São Paulo, SP","platform":"instagram"}]\n\`\`\``;

  return runManusAndParse(cacheKey, prompt, normalizeBuyer, getFallbackBuyers());
}

// ── OLX listings ──────────────────────────────────────────────────────────────
export async function scrapeOLXListings(category = "all") {
  const cacheKey = `olx_${category}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const queries = buildOLXQueries(category);
  const prompt = `Acesse olx.com.br e pesquise em "Coleções e Hobbies" por: ${queries.join(", ")}. Extraia anúncios de cartas avulsas. Retorne JSON com até 15:\n\`\`\`json\n[{"name":"Charizard VMAX","price":280,"location":"São Paulo, SP","url":"https://olx.com.br/...","type":"pokemon","condition":"NM","seller":"vendedor"}]\n\`\`\``;

  return runManusAndParse(cacheKey, prompt, normalizeOLXListing, []);
}

// ── Facebook group buyers ─────────────────────────────────────────────────────
export async function scrapeFacebookBuyers(cardTypes = ["pokemon","magic"]) {
  const cacheKey = `fb_buyers_${cardTypes.join("_")}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `Acesse grupos públicos do Facebook de compra e venda de cartas TCG no Brasil: "Pokémon TCG Brasil - Compra e Venda", "Magic The Gathering Brasil", "One Piece Card Game Brasil", "Dragon Ball Super Card Game Brasil". Busque posts recentes (7 dias) de pessoas QUERENDO COMPRAR (palavras: "procuro","WTB","quero comprar","alguém tem"). Retorne JSON com até 10:\n\`\`\`json\n[{"handle":"Nome Pessoa","initials":"NP","wants":["carta1"],"budget":200,"lastActive":"3h atrás","location":"Cidade, Estado","platform":"facebook"}]\n\`\`\``;

  return runManusAndParse(cacheKey, prompt, normalizeBuyer, []);
}

// ── Normalizadores ────────────────────────────────────────────────────────────
function normalizeBuyer(b, i) {
  if (!b) return null;
  return {
    id:        `manus_${Date.now()}_${i}`,
    handle:    b.handle || `@comprador_${i}`,
    initials:  b.initials || (b.handle||"??").replace("@","").slice(0,2).toUpperCase(),
    wants:     Array.isArray(b.wants) ? b.wants : [b.wants||"cartas"],
    budget:    Number(b.budget) || 0,
    lastActive:b.lastActive || "recente",
    location:  b.location || "Brasil",
    platform:  b.platform || "instagram",
  };
}

function normalizeOLXListing(item, i) {
  if (!item?.price) return null;
  const price = parseFloat(item.price) || 0;
  if (price <= 0) return null;
  return {
    id:       `olx_${Date.now()}_${i}`,
    type:     item.type || "pokemon",
    name:     item.name || "Carta TCG",
    set:      item.condition || "OLX",
    price,
    market:   Math.round(price * 1.35),
    score:    50,
    platform: "OLX",
    url:      item.url || "https://www.olx.com.br/brasil/q-cartas-tcg",
    location: item.location || "Brasil",
    buyers:   [],
    tier:     "ok",
    seller:   item.seller || null,
    qty:      1,
  };
}

// ── Builders ──────────────────────────────────────────────────────────────────
function buildHashtags(types) {
  const map = {
    pokemon:  ["#comproPokemon","#procuroPokemon","#WTBpokemon","#pokemonTCGbrasil"],
    magic:    ["#comproMagic","#procuroMTG","#WTBmagic","#magicBrasil"],
    onepiece: ["#comproOnePiece","#WTBonepiece","#onepiececardgamebr"],
    dragon:   ["#comproDragonBall","#DBSCG","#dragonballcardgame"],
  };
  return types.flatMap(t => map[t] || []).slice(0, 8);
}

function buildOLXQueries(category) {
  const map = {
    all:      ["cartas pokemon vmax", "cartas magic reserved", "one piece card sec", "dragon ball sp card"],
    pokemon:  ["pokemon vmax ex secret rare", "pokemon psa graded", "charizard pikachu vmax"],
    magic:    ["magic the gathering power 9", "magic reserved list", "magic commander staple"],
    onepiece: ["one piece card game sec rare", "one piece op01 op02"],
    dragon:   ["dragon ball super card sp", "dragon ball fusion world"],
  };
  return map[category] || map.all;
}

function getFallbackBuyers() {
  return [
    { id:"f1", handle:"@grazi.poke",    initials:"GR", wants:["charizard vmax","pikachu ex"],  budget:420,  lastActive:"2h atrás",   location:"São Paulo, SP",      platform:"instagram" },
    { id:"f2", handle:"@felipelima_mtg",initials:"FL", wants:["black lotus","force of will"],  budget:2000, lastActive:"1h atrás",   location:"Rio de Janeiro, RJ", platform:"instagram" },
    { id:"f3", handle:"@tati_onepiece", initials:"TA", wants:["luffy sec","nami l"],            budget:250,  lastActive:"30min atrás",location:"Curitiba, PR",        platform:"instagram" },
    { id:"f4", handle:"@joao.dbfz",     initials:"JO", wants:["goku sp","vegeta sr"],           budget:150,  lastActive:"5h atrás",   location:"BH, MG",             platform:"instagram" },
    { id:"f5", handle:"@rodrigo_tcg",   initials:"RO", wants:["dual lands","mox ruby"],         budget:1500, lastActive:"20min atrás",location:"São Paulo, SP",       platform:"instagram" },
  ];
}
