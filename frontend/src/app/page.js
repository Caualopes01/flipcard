"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchOpportunities, fetchDemand, formatBRL } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";
import styles from "./page.module.css";

const CATEGORIES = [
  { key: "all", label: "Todos" },
  { key: "pokemon", label: "Pokémon" },
  { key: "magic", label: "Magic" },
  { key: "onepiece", label: "One Piece" },
  { key: "dragon", label: "Dragon Ball" },
];

// Dados fallback caso o backend não esteja rodando
const FALLBACK_DATA = [
  { id: 1, type: "pokemon", name: "Charizard VMAX Rainbow Rare", set: "Champion's Path · PSA 9", price: 320, market: 580, score: 94, platform: "ML", buyers: ["GR","KT","PL"], tier: "hot", url: "https://lista.mercadolivre.com.br/charizard-vmax" },
  { id: 2, type: "magic", name: "Black Lotus (Reprint Alpha)", set: "Mystery Booster · NM", price: 880, market: 1400, score: 88, platform: "ML", buyers: ["FE","RO","MK"], tier: "hot", url: "https://lista.mercadolivre.com.br/" },
  { id: 3, type: "onepiece", name: "Monkey D. Luffy OP01-060 SEC", set: "Romance Dawn · MP", price: 190, market: 310, score: 81, platform: "ML", buyers: ["TA","YU"], tier: "good", url: "https://lista.mercadolivre.com.br/" },
  { id: 4, type: "dragon", name: "Son Goku SS4 SP Card", set: "Fusion World · LP", price: 75, market: 140, score: 79, platform: "ML", buyers: ["JO","CA","BE"], tier: "good", url: "https://lista.mercadolivre.com.br/" },
  { id: 5, type: "pokemon", name: "Pikachu VMAX Vivid Voltage", set: "Vivid Voltage · NM", price: 85, market: 150, score: 73, platform: "ML", buyers: ["LU","ME"], tier: "good", url: "https://lista.mercadolivre.com.br/" },
  { id: 6, type: "magic", name: "Ragavan Nimble Pilferer", set: "Modern Horizons 2 · NM", price: 210, market: 340, score: 68, platform: "ML", buyers: ["DA"], tier: "ok", url: "https://lista.mercadolivre.com.br/" },
];

const FALLBACK_DEMAND = [
  { id:"b1", handle:"@grazi.poke", initials:"GR", wants:["charizard","pikachu"], budget:420, lastActive:"2h atrás", location:"São Paulo, SP" },
  { id:"b2", handle:"@felipelima_mtg", initials:"FL", wants:["black lotus","force of will"], budget:2000, lastActive:"1h atrás", location:"Rio de Janeiro, RJ" },
  { id:"b3", handle:"@tati_onepiece", initials:"TA", wants:["luffy sec","nami"], budget:250, lastActive:"30min atrás", location:"Curitiba, PR" },
  { id:"b4", handle:"@joao.dbfz", initials:"JO", wants:["goku sp","vegeta"], budget:150, lastActive:"5h atrás", location:"Belo Horizonte, MG" },
  { id:"b5", handle:"@rodrigo_tcg", initials:"RO", wants:["dual lands","mox"], budget:1500, lastActive:"20min atrás", location:"São Paulo, SP" },
];

export default function Home() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(FALLBACK_DATA);
  const [demand, setDemand] = useState(FALLBACK_DEMAND);
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);

  const load = useCallback(async (cat) => {
    setLoading(true);
    try {
      const [opps, buyers] = await Promise.all([
        fetchOpportunities(cat),
        fetchDemand(),
      ]);
      if (opps.length > 0) { setData(opps); setApiOnline(true); }
      if (buyers.length > 0) setDemand(buyers);
    } catch {
      // usa fallback silenciosamente
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(category); }, [category]);

  const filtered = data.filter(
    (d) =>
      (category === "all" || d.type === category) &&
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  const hotCount = filtered.filter((d) => d.tier === "hot").length;
  const avgDisc = filtered.length
    ? Math.round(filtered.reduce((s, d) => s + ((d.market - d.price) / d.market) * 100, 0) / filtered.length)
    : 0;
  const buyerCount = new Set(filtered.flatMap((d) => d.buyers || [])).size;

  const catCounts = ["pokemon","magic","onepiece","dragon"].map((k) => ({
    key: k,
    label: { pokemon:"Pokémon", magic:"Magic", onepiece:"One Piece", dragon:"Dragon Ball" }[k],
    count: data.filter((d) => d.type === k).length,
    color: { pokemon:"#fbbf24", magic:"#a78bfa", onepiece:"#f87171", dragon:"#fb923c" }[k],
  }));
  const maxCount = Math.max(...catCounts.map((c) => c.count), 1);

  return (
    <div className={styles.root}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <div className={styles.logo}>
          CardFlip
          <span>Caça-Oportunidades</span>
        </div>
        <nav className={styles.filters}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`${styles.filterBtn} ${category === c.key ? styles.active : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </header>

      <div className={styles.main}>
        {/* Feed */}
        <section className={styles.feed}>
          {/* Search */}
          <div className={styles.searchBar}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{opacity:0.3}}>
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5"/>
              <path d="M11 11L14 14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar carta específica..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Platform chips */}
          <div className={styles.platformRow}>
            <span className={`${styles.chip} ${styles.chipML}`}>● Mercado Livre</span>
            <span className={`${styles.chip} ${styles.chipOLX}`}>● OLX</span>
            <span className={`${styles.chip} ${styles.chipIG}`}>● Instagram</span>
          </div>

          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Oportunidades</h2>
            <div className={styles.liveBadge}>
              <div className={styles.liveDot} />
              {loading ? "Buscando..." : "Atualizado agora"}
            </div>
          </div>

          {/* API Status */}
          <div className={`${styles.apiStatus} ${apiOnline ? styles.statusOk : styles.statusWarn}`}>
            <div className={styles.statusDot} />
            {apiOnline
              ? "Conectado · Mercado Livre API ativa"
              : "Backend offline · exibindo dados de demonstração · rode o backend para dados reais"}
          </div>

          {/* Cards */}
          <div className={styles.cardGrid}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>Nenhuma oportunidade encontrada.</div>
            ) : (
              filtered.map((item, i) => (
                <OpportunityCard key={item.id} item={item} index={i} />
              ))
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          {/* Stats */}
          <div className={styles.sideSection}>
            <div className={styles.sideLabel}>Visão Geral</div>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <div className={styles.statVal}>{filtered.length}</div>
                <div className={styles.statDesc}>oportunidades</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal}>{hotCount}</div>
                <div className={styles.statDesc}>alertas quentes</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal}>{avgDisc}%</div>
                <div className={styles.statDesc}>desconto médio</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal}>{buyerCount}</div>
                <div className={styles.statDesc}>compradores</div>
              </div>
            </div>
          </div>

          {/* Demand */}
          <div className={styles.sideSection}>
            <div className={styles.sideLabel}>Compradores Ativos (Instagram)</div>
            {demand.map((b) => (
              <div key={b.id} className={styles.demandItem}>
                <div className={styles.demandAvatar}>{b.initials}</div>
                <div className={styles.demandInfo}>
                  <div className={styles.demandHandle}>{b.handle}</div>
                  <div className={styles.demandWant}>{b.wants.join(", ")}</div>
                </div>
                <div className={styles.demandBudget}>{formatBRL(b.budget)}</div>
              </div>
            ))}
          </div>

          {/* Category bars */}
          <div className={styles.sideSection}>
            <div className={styles.sideLabel}>Por Categoria</div>
            {catCounts.map((c) => (
              <div key={c.key} className={styles.barRow}>
                <span className={styles.barLabel}>{c.label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(c.count / maxCount) * 100}%`, background: c.color }}
                  />
                </div>
                <span className={styles.barVal}>{c.count}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
