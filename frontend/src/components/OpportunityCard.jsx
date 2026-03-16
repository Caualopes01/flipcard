"use client";
import { formatBRL, calcDiscount } from "../lib/api";
import styles from "./OpportunityCard.module.css";

const TYPE_LABELS = {
  pokemon: "Pokémon",
  magic: "Magic",
  onepiece: "One Piece",
  dragon: "Dragon Ball",
};

export default function OpportunityCard({ item, index }) {
  const disc = calcDiscount(item.price, item.market);

  return (
    <div
      className={`${styles.card} ${styles[item.tier]}`}
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={() => window.open(item.url, "_blank")}
    >
      <div className={styles.top}>
        <div>
          <div className={styles.meta}>
            <span className={`${styles.tag} ${styles[`tag_${item.type}`]}`}>
              {TYPE_LABELS[item.type] || item.type}
            </span>
            <span className={styles.platform}>{item.platform}</span>
            {item.location && (
              <span className={styles.location}>{item.location}</span>
            )}
          </div>
          <div className={styles.name}>{item.name}</div>
          <div className={styles.set}>{item.set}</div>
        </div>
        <div className={styles.scoreBlock}>
          <div className={`${styles.scoreNum} ${styles[`score_${item.tier}`]}`}>
            {item.score}
          </div>
          <div className={styles.scoreLabel}>score</div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.priceRow}>
          <span className={styles.priceAsk}>{formatBRL(item.price)}</span>
          <span className={styles.priceMarket}>{formatBRL(item.market)}</span>
          <span className={styles.priceDiff}>-{disc}%</span>
        </div>

        {item.buyers?.length > 0 && (
          <div className={styles.buyers}>
            <div className={styles.avatars}>
              {item.buyers.slice(0, 3).map((b, i) => (
                <div key={i} className={styles.avatar}>{b}</div>
              ))}
            </div>
            <span>{item.buyers.length} compradores</span>
          </div>
        )}
      </div>

      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt={item.name}
          className={styles.thumb}
          loading="lazy"
        />
      )}
    </div>
  );
}
