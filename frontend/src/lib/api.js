const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function fetchOpportunities(category = "all", limit = 20) {
  const res = await fetch(`${API}/api/opportunities?category=${category}&limit=${limit}`);
  if (!res.ok) throw new Error("Erro ao buscar oportunidades");
  const json = await res.json();
  return json.data || [];
}

export async function fetchDemand(query = "") {
  const res = await fetch(`${API}/api/demand${query ? `?query=${query}` : ""}`);
  if (!res.ok) throw new Error("Erro ao buscar demanda");
  const json = await res.json();
  return json.data || [];
}

// Formata preço em BRL
export function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

// Calcula % de desconto
export function calcDiscount(price, market) {
  if (!market || market <= 0) return 0;
  return Math.round(((market - price) / market) * 100);
}
