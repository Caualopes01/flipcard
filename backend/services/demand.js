import { fetchMYPWishlists }       from "./mypcards.js";
import { scrapeInstagramBuyers, scrapeFacebookBuyers } from "./manus.js";

/**
 * Agrega compradores de todas as fontes:
 *   1. MYP Cards — pastas virtuais públicas (mais confiável, dados estruturados)
 *   2. Instagram — hashtags WTB via Manus
 *   3. Facebook  — grupos TCG Brasil via Manus
 */
export async function getDemand(query = "") {
  const hasManusKey = !!process.env.MANUS_API_KEY;

  // Busca em paralelo para não bloquear
  const [mypBuyers, igBuyers, fbBuyers] = await Promise.allSettled([
    fetchMYPWishlists(query),
    hasManusKey ? scrapeInstagramBuyers() : Promise.resolve([]),
    hasManusKey ? scrapeFacebookBuyers()  : Promise.resolve([]),
  ]);

  // Consolida resultados (Promise.allSettled nunca rejeita)
  const all = [
    ...(mypBuyers.status  === "fulfilled" ? mypBuyers.value  : []),
    ...(igBuyers.status   === "fulfilled" ? igBuyers.value   : []),
    ...(fbBuyers.status   === "fulfilled" ? fbBuyers.value   : []),
  ];

  // Se todas as fontes falharam, usa fallback
  if (all.length === 0) return getFallbackBuyers();

  // Deduplica por handle
  const seen = new Set();
  const deduped = all.filter(b => {
    if (seen.has(b.handle)) return false;
    seen.add(b.handle);
    return true;
  });

  // Filtra por query se fornecida
  if (query) {
    const q = query.toLowerCase();
    return deduped.filter(b =>
      b.wants?.some(w => w.toLowerCase().includes(q)) ||
      b.handle?.toLowerCase().includes(q) ||
      b.location?.toLowerCase().includes(q)
    );
  }

  return deduped;
}

function getFallbackBuyers() {
  return [
    { id:"f1", handle:"@grazi.poke",    initials:"GR", wants:["charizard vmax","pikachu ex"],  budget:420,  lastActive:"2h atrás",   location:"São Paulo, SP",      platform:"instagram" },
    { id:"f2", handle:"@felipelima_mtg",initials:"FL", wants:["black lotus","force of will"],  budget:2000, lastActive:"1h atrás",   location:"Rio de Janeiro, RJ", platform:"instagram" },
    { id:"f3", handle:"@tati_onepiece", initials:"TA", wants:["luffy sec","nami l"],            budget:250,  lastActive:"30min atrás",location:"Curitiba, PR",        platform:"mypcards"  },
    { id:"f4", handle:"@joao.dbfz",     initials:"JO", wants:["goku sp","vegeta sr"],           budget:150,  lastActive:"5h atrás",   location:"BH, MG",             platform:"facebook"  },
    { id:"f5", handle:"@rodrigo_tcg",   initials:"RO", wants:["dual lands","mox ruby"],         budget:1500, lastActive:"20min atrás",location:"São Paulo, SP",       platform:"instagram" },
  ];
}
