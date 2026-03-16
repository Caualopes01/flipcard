/**
 * MYP Cards Service
 *
 * Dois usos:
 * 1. OFERTA  — buscar cartas à venda (menor preço por carta no marketplace)
 * 2. DEMANDA — buscar pastas virtuais públicas (usuários que querem comprar)
 *
 * API pública documentada em: https://mypcards.github.io/mypcards-api
 * Base URL: https://api.mypcards.com  (inferido da documentação Swagger)
 * Sem autenticação necessária para leitura pública.
 */

const MYP_BASE = "https://api.mypcards.com";

// Mapeamento de categoria interna → slug do MYP Cards
const GAME_SLUGS = {
  pokemon:  "pokemon",
  magic:    "magic",
  onepiece: "one-piece",
  dragon:   "dragon-ball-super",
  yugioh:   "yugioh",
  digimon:  "digimon",
};

// Cache em memória
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

function getCached(key) {
  const e = cache.get(key);
  if (!e || Date.now() > e.expiresAt) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// Requisição genérica com retry
async function mypFetch(path, params = {}) {
  const url = new URL(path, MYP_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "CardFlip/1.0 (contato@cardflip.com.br)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) { await sleep(2000); continue; }
      if (!res.ok) throw new Error(`MYP HTTP ${res.status} em ${path}`);
      return await res.json();
    } catch (err) {
      if (attempt === 1) throw err;
      await sleep(1000);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Busca listagens de venda no MYP Cards
 * Retorna array no formato padrão do CardFlip
 */
export async function fetchMYPListings(category = "all", limit = 20) {
  const cacheKey = `myp_listings_${category}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const games = category === "all"
    ? Object.keys(GAME_SLUGS)
    : [category].filter(c => GAME_SLUGS[c]);

  const results = [];

  for (const game of games.slice(0, 3)) {
    try {
      // Endpoint: /products?game={slug}&sort=price_asc&limit=N
      const data = await mypFetch("/products", {
        game: GAME_SLUGS[game],
        sort: "price_asc",
        limit: Math.ceil(limit / games.length),
        available: true,
      });

      const items = data?.data || data?.products || data?.items || [];

      for (const item of items) {
        const price  = parseFloat(item.price || item.min_price || 0);
        const market = parseFloat(item.market_price || item.avg_price || item.reference_price || 0);

        if (!price || price <= 0) continue;

        // Se não tem preço de mercado, usa 30% acima do menor preço como referência mínima
        const refPrice = market > price ? market : price * 1.3;
        const discount = Math.round(((refPrice - price) / refPrice) * 100);
        if (discount < 10) continue;

        const score = calcScore(discount, item.qty_available || 1, item.views || 0);

        results.push({
          id:        `myp_${item.id || item.product_id}`,
          type:      game,
          name:      item.name || item.title || "Carta MYP",
          set:       [item.edition, item.condition, item.language].filter(Boolean).join(" · ") || "MYP Cards",
          price,
          market:    Math.round(refPrice),
          score,
          platform:  "MYP",
          url:       item.url || `https://mypcards.com/${GAME_SLUGS[game]}/produto/${item.id}/${slugify(item.name || "")}`,
          thumbnail: item.image || item.thumbnail || null,
          location:  item.seller_city || "Brasil",
          buyers:    [],
          tier:      score >= 80 ? "hot" : score >= 65 ? "good" : "ok",
          seller:    item.seller_name || item.seller || null,
          qty:       item.qty_available || 1,
        });
      }
    } catch (err) {
      console.warn(`[MYP] Erro ao buscar ${game}:`, err.message);
      // Continua para o próximo jogo sem quebrar
    }
  }

  const sorted = results.sort((a, b) => b.score - a.score).slice(0, limit);
  if (sorted.length > 0) setCache(cacheKey, sorted);
  return sorted;
}

/**
 * Busca pastas virtuais públicas — compradores anunciando o que querem
 * Retorna array no formato padrão de demanda do CardFlip
 */
export async function fetchMYPWishlists(query = "") {
  const cacheKey = `myp_wishlists_${query}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Endpoint: /wishlists/public?q={query}&limit=20
    const data = await mypFetch("/wishlists/public", {
      ...(query && { q: query }),
      limit: 20,
      sort: "recent",
    });

    const lists = data?.data || data?.wishlists || [];

    const buyers = lists.map((w, i) => ({
      id:         `myp_wish_${w.id || i}`,
      handle:     w.username || w.user || `@usuario_myp_${i}`,
      initials:   (w.username || "??").slice(0, 2).toUpperCase(),
      wants:      (w.items || []).map(item => item.name || item.title).filter(Boolean).slice(0, 5),
      budget:     parseFloat(w.max_budget || w.total_value || 0),
      lastActive: w.updated_at ? formatRelative(w.updated_at) : "recente",
      location:   w.city || w.state || "Brasil",
      platform:   "mypcards",
      profileUrl: `https://mypcards.com/${w.username}`,
    }));

    if (buyers.length > 0) setCache(cacheKey, buyers);
    return buyers;
  } catch (err) {
    console.warn("[MYP] Erro ao buscar wishlists:", err.message);
    return [];
  }
}

/**
 * Busca preço médio de uma carta específica no MYP (referência de mercado BR)
 * Útil para calibrar o score de oportunidade do Mercado Livre
 */
export async function getMYPMarketPrice(cardName, game) {
  try {
    const data = await mypFetch("/products/price", {
      name: cardName,
      game: GAME_SLUGS[game] || game,
    });
    return parseFloat(data?.avg_price || data?.market_price || 0) || null;
  } catch {
    return null;
  }
}

// Helpers
function calcScore(discountPct, qty, views) {
  const dScore = Math.min(discountPct * 1.2, 60);
  const vScore = Math.min((views / 100) * 10, 20);
  const qScore = qty > 1 ? 5 : 0;
  return Math.min(Math.round(dScore + vScore + qScore + 15), 99);
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60);
}

function formatRelative(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600)  return `${Math.round(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h atrás`;
  return `${Math.round(diff / 86400)}d atrás`;
}
