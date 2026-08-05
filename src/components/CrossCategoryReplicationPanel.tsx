import type { AmazonCrossCategorySummary, EstimateInterval } from "../data";

const MAX_EFFECT = 0.8;

function position(value: number) {
  return `${Math.max(0, Math.min(100, (value / MAX_EFFECT) * 100))}%`;
}

function ForestRow({ label, interval, pooled = false }: {
  label: string;
  interval: EstimateInterval;
  pooled?: boolean;
}) {
  return (
    <div className={`replication-forest-row${pooled ? " is-pooled" : ""}`}>
      <strong>{label}</strong>
      <div className="replication-interval" aria-label={`${label}: ${interval.estimate.toFixed(3)}, 95% interval ${interval.lower95.toFixed(3)} to ${interval.upper95.toFixed(3)}`}>
        <i
          className="replication-whisker"
          style={{ left: position(interval.lower95), width: position(interval.upper95 - interval.lower95) }}
        />
        <i className="replication-point" style={{ left: position(interval.estimate) }} />
      </div>
      <span>
        {interval.estimate > 0 ? "+" : ""}{interval.estimate.toFixed(3)}
        <small>[{interval.lower95.toFixed(3)}, {interval.upper95.toFixed(3)}]</small>
      </span>
    </div>
  );
}

export function CrossCategoryReplicationPanel({ summary }: { summary: AmazonCrossCategorySummary }) {
  const pooled = summary.inference.fixedSetEqualCategoryPooledPersistExcess;
  const totalHistories = summary.categories.reduce(
    (total, category) => total + category.dataset.userCount,
    0
  );
  const totalEvents = summary.categories.reduce(
    (total, category) => total + category.dataset.retainedEventCount,
    0
  );

  return (
    <section className="cross-category-replication" aria-labelledby="cross-category-title">
      <header>
        <div>
          <span className="mono-label">REPLICATION / FOUR COMMERCE DOMAINS</span>
          <h3 id="cross-category-title">The direction held. The size did not.</h3>
        </div>
        <p>
          One SASRec protocol, unchanged across personal care, software,
          specialist procurement, and replenishment goods. Intervals resample
          users and model initializations—not repeated rows as if they were new people.
        </p>
      </header>

      <div className="replication-lead">
        <div>
          <span>EQUAL-CATEGORY EFFECT</span>
          <strong>+{pooled.estimate.toFixed(3)}</strong>
          <p>excess target-family slots in the top 10</p>
        </div>
        <blockquote>
          <b>95% hierarchical bootstrap</b>
          <span>{pooled.lower95.toFixed(3)} — {pooled.upper95.toFixed(3)}</span>
          <p>Every leave-one-category-out lower bound remained above zero.</p>
        </blockquote>
      </div>

      <div className="replication-forest">
        <div className="replication-axis" aria-hidden="true">
          <i />
          <div><span>0</span><span>EXCESS SLOTS @10</span><span>+0.8</span></div>
          <i />
        </div>
        {summary.categories.map((category) => (
          <ForestRow
            key={category.slug}
            label={category.label}
            interval={category.uncertainty.persistExcess}
          />
        ))}
        <ForestRow label="Equal-category pooled" interval={pooled} pooled />
      </div>

      <div className="replication-ledger">
        <dl>
          <div><dt>Real histories</dt><dd>{totalHistories.toLocaleString()}</dd></div>
          <div><dt>Retained events</dt><dd>{totalEvents.toLocaleString()}</dd></div>
          <div><dt>Trained checkpoints</dt><dd>12</dd></div>
          <div><dt>Bootstrap replicates</dt><dd>{summary.inference.replicates.toLocaleString()}</dd></div>
        </dl>
        <ol>
          {summary.categories.map((category, index) => (
            <li key={category.slug}>
              <span>0{index + 1}</span>
              <div>
                <strong>{category.label}</strong>
                <small>
                  SASRec − popularity NDCG {category.performanceUncertainty.ndcgGainVsPopularity.estimate > 0 ? "+" : ""}
                  {category.performanceUncertainty.ndcgGainVsPopularity.estimate.toFixed(3)}
                </small>
              </div>
              <b>{category.taskUserCount} users</b>
            </li>
          ))}
        </ol>
      </div>

      <footer>
        <p>
          <strong>What replicated:</strong> all four category-specific 95%
          intervals were positive, outcome-only commit was smaller in all four,
          and holding before activation changed no paired ranking.
        </p>
        <p>
          <strong>What varied:</strong> point estimates ranged across&nbsp;
          {summary.inference.betweenCategoryDescriptive.range.toFixed(3)} slots.
          This is evidence of domain heterogeneity, not one universal effect size.
        </p>
      </footer>
    </section>
  );
}
