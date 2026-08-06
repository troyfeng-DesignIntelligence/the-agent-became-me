import type {
  CandidateMarginSummary,
  CrossLlmPilotSummary,
  DecodingDoseSummary,
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
  margin
}: {
  originalMimo: MiMoLlmPilotSummary;
  matchedMimo: CrossLlmPilotSummary;
  deepseek: CrossLlmPilotSummary;
  dose: DecodingDoseSummary;
  forced: ForcedInspectionSummary;
  margin: CandidateMarginSummary;
}) {
  const metrics = [
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

  return (
    <section className="llm-feedback-panel" aria-labelledby="llm-feedback-title">
      <header>
        <span className="mono-label">FRONTIER LLM PILOTS / 32 FROZEN TASKS</span>
        <h3 id="llm-feedback-title">The response differed. The shelf was not fully frozen.</h3>
        <p>
          MiMo and DeepSeek received the same task design, but a later audit found the
          learned recommenders were still in training mode. The historical response
          difference remains observed; an exact same-shelf causal comparison does not.
        </p>
      </header>

      <div className="llm-feedback-grid">
        {metrics.map((metric) => (
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

      <div className="llm-feedback-chain" aria-label="Observed boundary chain">
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
          <span className="mono-label">DECODING DOSE / SHAM-ADJUSTED</span>
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
                <span
                  role="cell"
                  key={cell.temperature}
                  data-temperature={`T ${cell.temperature.toFixed(1)}`}
                >
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
          <span className="mono-label">FORCED INSPECTION / TEMPERATURE 0</span>
          <h4>The browsing trace moved. MiMo's decision did not.</h4>
        </header>
        {(["mimo", "deepseek"] as const).map((provider) => {
          const result = forced.providers[provider];
          return (
            <article key={provider}>
              <span>{provider === "mimo" ? "MiMo" : "DeepSeek"}</span>
              <div>
                <p><strong>{percent(result.wholeTraceDivergenceRate)}</strong> whole trace</p>
                <b aria-hidden="true">↓</b>
                <p>
                  <strong>{percent(result.adjustedPersistentResolvedActionFeedback)}</strong>
                  resolved action
                </p>
              </div>
            </article>
          );
        })}
        <p className="llm-feedback-resolved__note">
          A controller-required recommendation view changed MiMo's browsing history in
          24/32 pairs, but changed its final selected item or abandon outcome in 0/32.
          Trace divergence alone would have overstated the behavioral result.
        </p>
      </div>

      <div className="llm-feedback-audit">
        <header>
          <span className="mono-label">FROZEN SCALE GATE / NO-GO</span>
          <h4>The proposed decision margin could not explain the split.</h4>
          <p>
            This analysis uses the pseudonymous candidate features actually sent to
            each provider, avoiding a non-deterministic shelf reconstruction.
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
          All 13 analyzable top-two utility gaps were zero. The preregistered
          mechanism gate failed, so third-provider and confirmatory calls are paused.
          The repaired recommender now passes a separate 32/32 within-process and
          fresh-process determinism preflight; that fixes future measurement, not this
          failed mechanism.
        </p>
      </div>

      <footer>
        <p>
          <strong>Historical observation:</strong> MiMo produced 0/64 exposed trace divergences and
          DeepSeek produced 11/64, despite the same 69.7% mean shelf displacement. Both
          held-versus-held sham rates were 0/64.
        </p>
        <p>
          <strong>Boundary:</strong> The earlier MiMo pilot's {percent(originalMimo.descriptive.traceDivergenceRate)}
          trace divergence did not recur. Because recommender dropout was active, these
          historical runs do not identify a clean provider or exposure effect. Forced
          inspection still shows why browsing history and task resolution need separate measures.
        </p>
      </footer>
    </section>
  );
}
