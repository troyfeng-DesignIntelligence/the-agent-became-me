import type { ExternalValiditySummary } from "../data";

const labels: Record<string, { name: string; memory: string }> = {
  "content-centroid": { name: "Content profile", memory: "All observed genres accumulate" },
  "item-neighborhood": { name: "Item neighborhood", memory: "Nearby items vote collaboratively" },
  "sequential-transition": { name: "Sequential transition", memory: "Recent state dominates what comes next" }
};

export function ExternalValidationPanel({ summary }: { summary: ExternalValiditySummary }) {
  const personalized = Object.keys(labels).map((algorithm) => ({
    algorithm,
    persist: summary.algorithmLifecycle.find(
      (row) => row.algorithm === algorithm && row.lifecycle === "persist-all"
    )!,
    weighted: summary.algorithmLifecycle.find(
      (row) => row.algorithm === algorithm && row.lifecycle === "intent-weighted"
    )!
  }));

  return (
    <section className="external-validation" aria-labelledby="external-validation-title">
      <header>
        <div>
          <span className="mono-label">REAL HISTORIES / PAIRED COUNTERFACTUAL</span>
          <h3 id="external-validation-title">One temporary task. Three different memories.</h3>
        </div>
        <p>
          The original custom ranker was not enough. We repeated the task-boundary
          test on {summary.dataset.eligibleUserCount} chronological MovieLens histories,
          holding each candidate set and global model fixed.
        </p>
      </header>

      <div className="external-validation-ledger" aria-label="External validation scale">
        <div><strong>{summary.dataset.eligibleUserCount}</strong><span>real histories</span></div>
        <div><strong>{summary.design.rowCount.toLocaleString()}</strong><span>paired rows</span></div>
        <div><strong>{summary.observedComparisons.positivePersistAlgorithmCount}/3</strong><span>personalized families moved</span></div>
        <div><strong>0</strong><span>staged-hold mismatches</span></div>
      </div>

      <div className="external-validation-models">
        {personalized.map(({ algorithm, persist, weighted }, index) => (
          <article key={algorithm}>
            <span className="external-model-index">0{index + 1}</span>
            <div className="external-model-copy">
              <h4>{labels[algorithm].name}</h4>
              <p>{labels[algorithm].memory}</p>
            </div>
            <div className="external-model-bars">
              <div>
                <span>Persist all</span>
                <i style={{ "--external-width": `${persist.spilloverRate * 100}%` } as React.CSSProperties} />
                <strong>{(persist.spilloverRate * 100).toFixed(1)}%</strong>
              </div>
              <div className="is-weighted">
                <span>25% weight</span>
                <i style={{ "--external-width": `${weighted.spilloverRate * 100}%` } as React.CSSProperties} />
                <strong>{(weighted.spilloverRate * 100).toFixed(1)}%</strong>
              </div>
            </div>
            <dl>
              <div><dt>Top-10 replaced</dt><dd>{(persist.meanRankingDisplacementAt10 * 100).toFixed(1)}%</dd></div>
              <div><dt>Excess target slots</dt><dd>{persist.meanExcessTargetSlotsAt10.toFixed(2)}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <footer>
        <p>
          <strong>What changed:</strong> the effect survived three personalized
          recommender families, but its size did not. The sequential model was the
          most exposed, and simple downweighting barely changed its spillover rate.
        </p>
        <p>
          <strong>What did not:</strong> holding before platform activation reproduced the
          no-injection ranking exactly; global popularity was also invariant.
        </p>
      </footer>
    </section>
  );
}
