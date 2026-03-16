/**
 * Serviço de Preços de Referência
 *
 * Fontes em ordem de prioridade:
 *   1. MYP Cards — preço médio BR (mais relevante para o mercado nacional)
 *   2. TCGPlayer  — preço USD convertido para BRL (referência internacional)
 *   3. Tabela local hardcoded — fallback offline
 */

import { getMYPMarketPrice } from "./mypcards.js";

const CACHE_TTL = 60 * 60 * 1000; // 1 hora (preços mudam pouco)
const priceCache = new Map();

function getCached(key) {
  const e = priceCache.get(key);
  if (!e || Date.now() > e.expiresAt) { priceCache.delete(key); return null; }
  return e.data;
}
function setCache(key, val) {
  priceCache.set(key, { data: val, expiresAt: Date.now() + CACHE_TTL });
}

// Taxa de câmbio USD→BRL (atualizada via API se possível, fallback fixo)
let _usdToBRL = 5.1;
let _rateUpdatedAt = 0;

async function getUSDtoBRL() {
  if (Date.now() - _rateUpdatedAt < 6 * 3600 * 1000) return _usdToBRL;
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    _usdToBRL = data.rates?.BRL || 5.1;
    _rateUpdatedAt = Date.now();
  } catch {
    // usa valor fixo
  }
  return _usdToBRL;
}

/**
 * Busca o preço de referência de mercado para uma carta
 * @param {string} cardName
 * @param {string} game  pokemon|magic|onepiece|dragon
 * @returns {number|null}
 */
export async function getMarketPrice(cardName, game) {
  const key = `price_${game}_${cardName.toLowerCase().slice(0, 40)}`;
  const cached = getCached(key);
  if (cached) return cached;

  // 1. Tenta MYP Cards (preço BR)
  try {
    const mypPrice = await getMYPMarketPrice(cardName, game);
    if (mypPrice && mypPrice > 0) {
      setCache(key, mypPrice);
      return mypPrice;
    }
  } catch {}

  // 2. Tenta TCGPlayer (USD → BRL)
  try {
    const tcgPrice = await fetchTCGPlayerPrice(cardName, game);
    if (tcgPrice && tcgPrice > 0) {
      setCache(key, tcgPrice);
      return tcgPrice;
    }
  } catch {}

  // 3. Tabela local hardcoded
  const local = getLocalReferencePrice(cardName, game);
  if (local) setCache(key, local);
  return local;
}

async function fetchTCGPlayerPrice(cardName, game) {
  // TCGPlayer tem API pública não autenticada para preços
  const gameMap = { pokemon: "pokemon", magic: "magic", onepiece: "one-piece-card-game", dragon: "dragon-ball-super-card-game" };
  const tcgGame = gameMap[game] || game;

  const res = await fetch(
    `https://api.tcgplayer.com/pricing/product/${encodeURIComponent(cardName)}?game=${tcgGame}`,
    { signal: AbortSignal.timeout(5000), headers: { "Accept": "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const usdPrice = data?.results?.[0]?.marketPrice || data?.price;
  if (!usdPrice) return null;
  const rate = await getUSDtoBRL();
  return Math.round(usdPrice * rate);
}

// Tabela local de referência — preços BR aproximados
const LOCAL_PRICES = {
  pokemon: {
    "charizard vmax":        580, "pikachu vmax":           150, "umbreon vmax":           480,
    "rayquaza vmax":         200, "mewtwo v":               120, "charizard ex":           350,
    "lugia v":               180, "mew vmax":               320, "espeon vmax":            160,
    "sylveon vmax":          140, "gengar vmax":            200, "blissey v":               45,
    "charizard base set":   4500, "psa 10 charizard":      8000,
  },
  magic: {
    "black lotus":         45000, "mox ruby":              8000, "time walk":              5000,
    "ancestral recall":   12000, "timetwister":            4500, "mox sapphire":           9000,
    "ragavan":               340, "force of will":           120, "sol ring":                45,
    "fetchland":             280, "dual land":             1200, "liliana":                 180,
    "snapcaster mage":       200, "jace the mind sculptor":280,
  },
  onepiece: {
    "luffy sec":             310, "nami l":                  95, "zoro sec":               280,
    "shanks sp":             420, "yamato sec":             260, "boa hancock":             85,
    "monkey d. luffy":       310, "roronoa zoro":           220,
  },
  dragon: {
    "goku sp":               140, "vegeta sr":               72, "beerus sp":              190,
    "gohan sr":               65, "gogeta sp":              320, "broly sp":               280,
    "ultra instinct goku":   350, "jiren sr":                80,
  },
};

function getLocalReferencePrice(cardName, game) {
  const nameLower = cardName.toLowerCase();
  const table = LOCAL_PRICES[game] || {};

  // Busca exata
  if (table[nameLower]) return table[nameLower];

  // Busca parcial (primeiro match por palavra-chave)
  for (const [keyword, price] of Object.entries(table)) {
    const words = keyword.split(" ");
    if (words.some(w => w.length > 3 && nameLower.includes(w))) return price;
  }

  return null;
}
