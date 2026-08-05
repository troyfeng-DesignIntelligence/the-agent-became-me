import type { AmazonSasrecSummary } from "../data";

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);

const lifecycleLabels: Record<string, { index: string; name: string; note: string }> = {
  "persist-all": {
    index: "01",
    name: "Keep every task action",
    note: "Four temporary items enter the active sequence."
  },
  "outcome-commit": {
    index: "02",
    name: "Commit the selected outcome",
    note: "Only the final chosen item reaches the sequence."
  },
  "outcome-quarantine": {
    index: "03",
    name: "Hold before activation",
    note: "Temporary evidence never reaches the model."
  }
};

export function LearnedCommercePanel({ summary }: { summary: AmazonSasrecSummary }) {
  const runs = summary.model.trainingRuns;
  const sasrecNdcg = mean(runs.map((run) => run.test.sasrec.ndcgAt10));
  const popularityNdcg = mean(runs.map((run) => run.test.popularity.ndcgAt10));
  const transitionNdcg = mean(
    runs.map((run) => run.test.firstOrderTransition.ndcgAt10)
  );
  const orderedChange = mean(
    runs.map((run) => run.test.orderSensitivity.changedTop10Rate)
  );
  const lifecycle = ["persist-all", "outcome-commit", "outcome-quarantine"].map(
    (name) => summary.taskBoundary.lifecycle.find((row) => row.lifecycle === name)!
  );

  return (
    <section className="learned-commerce" aria-labelledby="learned-commerce-title">
      <header>
        <div>
          <span className="mono-label">REAL COMMERCE / TRAINED SEQUENCE MODEL</span>
          <h3 id="learned-commerce-title">The model learned. The temporary task travelled with it.</h3>
        </div>
        <p>
          Three SASRec models were trained from scratch on chronological Amazon
          Luxury Beauty interactions. Product titles helped define evaluation
          families; the model itself saw only item IDs and order.
        </p>
      </header>

      <div className="learned-commerce-scorecard">
        <article>
          <span>HELD-OUT NEXT ITEM / NDCG@10</span>
          <strong>{sasrecNdcg.toFixed(3)}</strong>
          <div className="learned-commerce-baselines">
            <p><i style={{ width: `${(popularityNdcg / sasrecNdcg) * 100}%` }} />Popularity <b>{popularityNdcg.toFixed(3)}</b></p>
            <p><i style={{ width: `${(transitionNdcg / sasrecNdcg) * 100}%` }} />1st-order transition <b>{transitionNdcg.toFixed(3)}</b></p>
            <p className="is-model"><i />SASRec <b>{sasrecNdcg.toFixed(3)}</b></p>
          </div>
        </article>
        <dl>
          <div><dt>Commerce histories</dt><dd>{summary.dataset.userCount.toLocaleString()}</dd></div>
          <div><dt>Retained events</dt><dd>{summary.dataset.retainedEventCount.toLocaleString()}</dd></div>
          <div><dt>Independent seeds</dt><dd>{runs.length}</dd></div>
          <div><dt>Order changed top-10</dt><dd>{(orderedChange * 100).toFixed(1)}%</dd></div>
        </dl>
      </div>

      <div className="learned-commerce-sequence" aria-label="Temporary task activation sequence">
        <div>
          <span>TEMPORARY TASK</span>
          <i /><i /><i /><i />
        </div>
        <b aria-hidden="true">→</b>
        <div className="is-transformer">
          <span>CAUSAL ATTENTION</span>
          <i /><i /><i />
        </div>
        <b aria-hidden="true">→</b>
        <div className="is-ranking">
          <span>NEXT TOP-10</span>
          {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
        </div>
      </div>

      <div className="learned-commerce-lifecycles">
        {lifecycle.map((row) => {
          const label = lifecycleLabels[row.lifecycle];
          return (
            <article className={row.lifecycle === "outcome-quarantine" ? "is-quarantine" : ""} key={row.lifecycle}>
              <span>{label.index}</span>
              <h4>{label.name}</h4>
              <p>{label.note}</p>
              <strong>{row.meanExcessTargetSlotsAt10 > 0 ? "+" : ""}{row.meanExcessTargetSlotsAt10.toFixed(3)}</strong>
              <small>mean excess target-family slots @10</small>
              <dl>
                <div><dt>Cases with spillover</dt><dd>{(row.spilloverRate * 100).toFixed(1)}%</dd></div>
                <div><dt>Ranking displaced</dt><dd>{(row.meanRankingDisplacementAt10 * 100).toFixed(1)}%</dd></div>
                <div><dt>Next-item hit Δ</dt><dd>{(row.meanNextItemHitDeltaAt10 * 100).toFixed(1)} pp</dd></div>
              </dl>
            </article>
          );
        })}
      </div>

      <footer>
        <p>
          <strong>What this adds:</strong> the spillover recurs in a learned,
          order-sensitive recommender on real e-commerce sequences—not only in
          a hand-written transition score.
        </p>
        <p>
          <strong>Where it stops:</strong> reviews are not delegated-agent logs,
          title tokens are evaluation proxies, and this is not Amazon's deployed model.
        </p>
      </footer>
    </section>
  );
}

