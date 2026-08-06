import type {
  CandidateMarginSummary,
  CrossLlmPilotSummary,
  DecodingDoseSummary,
  DeterministicRepairSummary,
  ForcedInspectionSummary,
  MiMoLlmPilotSummary
} from "../data";

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function LLMBehaviorFeedbackPanel({
  originalMimo,
  matchedMimo,
  deepseek,
  dose,
  forced,
  margin,
  repair
}: {
  originalMimo: MiMoLlmPilotSummary;
  matchedMimo: CrossLlmPilotSummary;
  deepseek: CrossLlmPilotSummary;
  dose: DecodingDoseSummary;
  forced: ForcedInspectionSummary;
  margin: CandidateMarginSummary;
  repair: DeterministicRepairSummary;
}) {
  const historicalMetrics = [
    {
      label: "Historical mean displacement",
      value: matchedMimo.descriptive.meanExposureT1,
      display: percent(matchedMimo.descriptive.meanExposureT1),
      note: "aggregate displacement; not an exact cross-provider shelf match"
    },
    {
      label: "MiMo matched trace",
      value: matchedMimo.descriptive.exposureTraceDivergenceRate,
      display: percent(matchedMimo.descriptive.exposureTraceDivergenceRate),
      note: "0/64 immediate-versus-held trajectories diverged"
    },
    {
      label: "DeepSeek matched trace",
      value: deepseek.descriptive.exposureTraceDivergenceRate,
      display: percent(deepseek.descriptive.exposureTraceDivergenceRate),
      note: "11/64 immediate-versus-held trajectories diverged"
    },
    {
      label: "DeepSeek persistent path",
      value: deepseek.descriptive.adjustedPersistentFeedback,
      display: percent(deepseek.descriptive.adjustedPersistentFeedback),
      note: "9/64 exposure events minus 0/64 held-sham events"
    }
  ];
  const temperatureKey = (temperature: number) =>
    `temperature${String(temperature).replace(".", "p")}`;
  const doseRows = (["mimo", "deepseek"] as const).map((provider) => ({
    provider,
    label: provider === "mimo" ? "MiMo" : "DeepSeek",
    cells: dose.temperatures.map(
      (temperature) => dose.providers[provider][temperatureKey(temperature)]
    )
  }));
  const repairEvents =
    repair.providers.mimo.persistentResolvedActionEventCount +
    repair.providers.deepseek.persistentResolvedActionEventCount;
  const opportunityEvents =
    repair.providers.mimo.eventCountOnOpportunityChangedTasks +
    repair.providers.deepseek.eventCountOnOpportunityChangedTasks;

  return (
    <section className="llm-feedback-panel" aria-labelledby="llm-feedback-title">
      <header>
        <span className="mono-label">DETERMINISTIC REPAIR / 32 FROZEN TASKS</span>
        <h3 id="llm-feedback-title">The shelf was frozen. The decision still moved.</h3>
        <p>
          We froze a predecision dominance score before any new calls, verified that
          it varied offline, and then ran the same paired test with MiMo and DeepSeek.
          This is an opportunity-enriched mechanism test, not a prevalence estimate.
        </p>
      </header>

      <div className="llm-feedback-repair">
        <header>
          <span className="mono-label">FROZEN MECHANISM GATE / PASSED</span>
          <h4>Lower separation anticipated resolved-action divergence.</h4>
          <p>
            Exposure and sham arms used deterministic SASRec or GRU4Rec shelves.
            The audit then checked the pseudonymous states actually sent to each model.
          </p>
        </header>
        <div className="llm-feedback-repair__grid">
          <article>
            <span>DeepSeek</span>
            <strong>7 / 32</strong>
            <p>exposure events; 1/32 sham · AUC {repair.providers.deepseek.mechanismAuc.toFixed(3)}</p>
          </article>
          <article>
            <span>MiMo</span>
            <strong>6 / 32</strong>
            <p>exposure events; 0/32 sham · AUC {repair.providers.mimo.mechanismAuc.toFixed(3)}</p>
          </article>
          <article>
            <span>Opportunity localization</span>
            <strong>{opportunityEvents} / {repairEvents}</strong>
            <p>all events occurred where exposure changed the actionable candidate set</p>
          </article>
          <article>
            <span>Actual-state audit</span>
            <strong>32 / 32</strong>
            <p>predictor and resolved decisions matched for each provider</p>
          </article>
        </div>
        <p className="llm-feedback-repair__note">
          DeepSeek passed the frozen primary test (AUC 0.780; exact one-sided
          p = 0.0115). MiMo independently pointed the same way (AUC 0.734;
          p = 0.0391). The 32 tasks were selected without outcomes from a 460-task
          pool that contained 37 exposure-created opportunities; the result therefore
          locates a mechanism but does not say how often it occurs naturally.
        </p>
      </div>

      <div className="llm-feedback-history-heading">
        <span className="mono-label">HISTORICAL RUNS / RETAINED AS AUDIT</span>
        <h4>The earlier shelf was not fully frozen.</h4>
        <p>
          These diagnostics explain why the runner and margin were redesigned. They
          are not pooled with the repaired pilot.
        </p>
      </div>

      <div className="llm-feedback-grid">
        {historicalMetrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.display}</strong>
            <div className="llm-feedback-track" aria-hidden="true">
              <i style={{ width: `${Math.max(1, metric.value * 100)}%` }} />
            </div>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="llm-feedback-chain" aria-label="Historical audit chain">
        <span>same frozen task design</span>
        <b aria-hidden="true">→</b>
        <span>dropout-active shelves</span>
        <b aria-hidden="true">→</b>
        <span>different observed response</span>
        <b aria-hidden="true">→</b>
        <span>causal attribution paused</span>
      </div>

      <div className="llm-feedback-diagnostics">
        <header>
          <span className="mono-label">HISTORICAL DECODING DOSE / SHAM-ADJUSTED</span>
          <h4>More randomness did not create a clean shared effect.</h4>
          <p>
            Each cell reports persistent exposure events after subtracting the held-sham
            rate. Cells are flagged when sham persistence exceeded 5%.
          </p>
        </header>
        <div className="llm-feedback-dose" role="table" aria-label="Temperature dose response">
          <div className="llm-feedback-dose__head" role="row">
            <span role="columnheader">Model</span>
            {dose.temperatures.map((temperature) => (
              <span role="columnheader" key={temperature}>T {temperature.toFixed(1)}</span>
            ))}
          </div>
          {doseRows.map((row) => (
            <div className="llm-feedback-dose__row" role="row" key={row.provider}>
              <strong role="rowheader">{row.label}</strong>
              {row.cells.map((cell) => (
                <span role="cell" key={cell.temperature} data-temperature={`T ${cell.temperature.toFixed(1)}`}>
                  <b>{percent(cell.adjustedPersistentFeedback)}</b>
                  <small>
                    sham {percent(cell.shamPersistentBehavioralFeedbackRate)}
                    {cell.shamPersistentBehavioralFeedbackRate > 0.05 ? " · noisy sham" : ""}
                  </small>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="llm-feedback-resolved">
        <header>
          <span className="mono-label">HISTORICAL FORCED INSPECTION / TEMPERATURE 0</span>
          <h4>The browsing trace moved. MiMo&apos;s decision did not.</h4>
        </header>
        {(["mimo", "deepseek"] as const).map((provider) => {
          const result = forced.providers[provider];
          return (
            <article key={provider}>
              <span>{provider === "mimo" ? "MiMo" : "DeepSeek"}</span>
              <div>
                <p><strong>{percent(result.wholeTraceDivergenceRate)}</strong> whole trace</p>
                <b aria-hidden="true">→</b>
                <p>
                  <strong>{percent(result.adjustedPersistentResolvedActionFeedback)}</strong>
                  resolved action
                </p>
              </div>
            </article>
          );
        })}
        <p className="llm-feedback-resolved__note">
          A controller-required recommendation view changed MiMo&apos;s browsing history in
          24/32 pairs, but changed its final selected item or abandon outcome in 0/32.
          Trace divergence alone would have overstated the behavioral result.
        </p>
      </div>

      <div className="llm-feedback-audit">
        <header>
          <span className="mono-label">HISTORICAL MARGIN / NO-GO</span>
          <h4>The first decision margin was degenerate.</h4>
          <p>
            This analysis used the pseudonymous candidate features actually sent to
            each provider. It remains a valid negative audit of the old instrument.
          </p>
        </header>
        <div>
          <article>
            <span>Margin-analyzable</span>
            <strong>{margin.providers.deepseek.analyzableCount}/32</strong>
            <p>40.6% observed · 90% required</p>
          </article>
          <article>
            <span>Margin AUC</span>
            <strong>{margin.providers.deepseek.marginAuc?.toFixed(2) ?? "n/a"}</strong>
            <p>0.50 chance · 0.70 required</p>
          </article>
          <article>
            <span>Permutation p</span>
            <strong>{margin.providers.deepseek.oneSidedPermutationP?.toFixed(2) ?? "n/a"}</strong>
            <p>100,000 frozen permutations</p>
          </article>
        </div>
        <p className="llm-feedback-audit__note">
          All 13 analyzable top-two utility gaps were zero. We did not loosen that
          failed gate. Instead, the new dominance score combined task match, platform
          rank, task-local rank, and novelty, then passed a separate offline support
          check before the repaired calls began.
        </p>
      </div>

      <footer>
        <p>
          <strong>What changed:</strong> the repaired pilot froze both stochastic layers,
          used an outcome-blind task manifest, and audited the exact sent state. Its
          mechanism result is prospective; it does not retroactively repair older runs.
        </p>
        <p>
          <strong>Boundary:</strong> the new evidence supports action divergence inside
          this research storefront when exposure creates an actionable opportunity and
          predecision separation is low. It does not establish human preference change,
          population prevalence, or production-retailer effects. The earlier MiMo pilot&apos;s
          {` ${percent(originalMimo.descriptive.traceDivergenceRate)} `}trace divergence remains historical.
        </p>
      </footer>
    </section>
  );
}
