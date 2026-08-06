import type {
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
  forced
}: {
  originalMimo: MiMoLlmPilotSummary;
  matchedMimo: CrossLlmPilotSummary;
  deepseek: CrossLlmPilotSummary;
  dose: DecodingDoseSummary;
  forced: ForcedInspectionSummary;
}) {
  const metrics = [
    {
      label: "Changed shelf / both models",
      value: matchedMimo.descriptive.meanExposureT1,
      display: percent(matchedMimo.descriptive.meanExposureT1),
      note: "mean in-task Top-10 displacement under immediate activation"
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
        <h3 id="llm-feedback-title">Same changed shelf. Different agent response.</h3>
        <p>
          MiMo and DeepSeek received the same frozen tasks, policies, and recommender
          contrasts. Both saw equally displaced shelves. Only DeepSeek changed its action
          path, making provider dependence part of the result rather than a footnote.
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
        <span>same task protocol</span>
        <b aria-hidden="true">→</b>
        <span>same shelf displacement</span>
        <b aria-hidden="true">→</b>
        <span>different model response</span>
        <b aria-hidden="true">→</b>
        <span>provider-contingent path</span>
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

      <footer>
        <p>
          <strong>Observed:</strong> MiMo produced 0/64 exposed trace divergences and
          DeepSeek produced 11/64, despite the same 69.7% mean shelf displacement. Both
          held-versus-held sham rates were 0/64.
        </p>
        <p>
          <strong>Boundary:</strong> The earlier MiMo pilot's {percent(originalMimo.descriptive.traceDivergenceRate)}
          trace divergence did not recur under the matched decoding protocol. The evidence
          supports a model-contingent boundary, not cross-LLM replication. Forced
          inspection further separates changed browsing history from changed task resolution.
        </p>
      </footer>
    </section>
  );
}
