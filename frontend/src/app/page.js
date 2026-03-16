"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchOpportunities, fetchDemand, formatBRL } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";
import styles from "./page.module.css";

const CATEGORIES = [
  { key: "all",      label: "Todos"       },
  { key: "pokemon",  label: "Pokémon"     },
  { key: "magic",    label: "Magic"       },
  { key: "onepiece", label: "One Piece"   },
  { key: "dragon",   label: "Dragon Ball" },
];

export default function Home() {
  const [category, setCategory] = useState("all");
  const [search,   setSearch]   = useState("");
  const [data,     setData]     = useState([]);
  const [demand,   setDemand]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [apiOnline, setApiOnline] = useState(false);

  const load = useCallback(async (cat) => {
    setLoading(true);
    setError(null);
    try {
      const [opps, buyers] = await Promise.all([
        fetchOpportunities(cat),
        fetchDemand(),
      ]);
      setData(opps   || []);
      setDemand(buyers || []);
      setApiOnline(true);
    } catch (err) {
      setError("Não foi possível conectar ao backend. Verifique se o Hugging Face Space está online.");
      setApiOnline(false);
      console.error("Erro ao carregar dados:", err);
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

  const hotCount  = filtered.filter((d) => d.tier === "hot").length;
  const avgDisc   = filtered.length
    ? Math.round(filtered.reduce((s, d) => s + ((d.market - d.price) / d.market) * 100, 0) / filtered.length)
    : 0;
  const buyerCount = new Set(filtered.flatMap((d) => d.buyers || [])).size;

  const catCounts = ["pokemon","magic","onepiece","dragon"].map((k) => ({
    key:   k,
    label: { pokemon:"Pokémon", magic:"Magic", onepiece:"One Piece", dragon:"Dragon Ball" }[k],
    count: data.filter((d) => d.type === k).length,
    color: { pokemon:"#fbbf24", magic:"#a78bfa", onepiece:"#f87171", dragon:"#fb923c" }[k],
  }));
  const maxCount = Math.max(...catCounts.map((c) => c.count), 1);

  return (
    <div className={styles.root}>
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
        <section className={styles.feed}>
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

          <div className={`${styles.apiStatus} ${apiOnline ? styles.statusOk : styles.statusWarn}`}>
            <div className={styles.statusDot} />
            {apiOnline
              ? "Conectado · dados reais do Mercado Livre, MYP Cards e OLX"
              : error || "Conectando ao backend..."}
          </div>

          <div className={styles.cardGrid}>
            {loading ? (
              <div className={styles.empty}>Buscando oportunidades...</div>
            ) : error ? (
              <div className={styles.empty}>{error}</div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>Nenhuma oportunidade encontrada.</div>
            ) : (
              filtered.map((item, i) => (
                <OpportunityCard key={item.id} item={item} index={i} />
              ))
            )}
          </div>
        </section>

        <aside className={styles.sidebar}>
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

          <div className={styles.sideSection}>
            <div className={styles.sideLabel}>Compradores Ativos (Instagram)</div>
            {demand.length === 0 ? (
              <div style={{fontSize:"12px", color:"var(--muted)", padding:"8px 0"}}>
                {loading ? "Buscando compradores..." : "Nenhum comprador encontrado."}
              </div>
            ) : (
              demand.map((b) => (
                <div key={b.id} className={styles.demandItem}>
                  <div className={styles.demandAvatar}>{b.initials}</div>
                  <div className={styles.demandInfo}>
                    <div className={styles.demandHandle}>{b.handle}</div>
                    <div className={styles.demandWant}>{b.wants.join(", ")}</div>
                  </div>
                  <div className={styles.demandBudget}>{formatBRL(b.budget)}</div>
                </div>
              ))
            )}
          </div>

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
