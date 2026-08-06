import type { CrossLlmPilotSummary, MiMoLlmPilotSummary } from "../data";

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function LLMBehaviorFeedbackPanel({
  mimo,
  deepseek
}: {
  mimo: MiMoLlmPilotSummary;
  deepseek: CrossLlmPilotSummary;
}) {
  const metrics = [
    {
      label: "MiMo exposure pair",
      value: mimo.descriptive.traceDivergenceRate,
      display: percent(mimo.descriptive.traceDivergenceRate),
      note: "trace divergence · original pilot · no independent sham"
    },
    {
      label: "DeepSeek exposure pair",
      value: deepseek.descriptive.exposureTraceDivergenceRate,
      display: percent(deepseek.descriptive.exposureTraceDivergenceRate),
      note: "trace divergence · immediate activation versus held"
    },
    {
      label: "DeepSeek held sham",
      value: deepseek.descriptive.shamTraceDivergenceRate,
      display: percent(deepseek.descriptive.shamTraceDivergenceRate),
      note: "independent held calls · identical semantic exposure"
    },
    {
      label: "Persistent feedback",
      value: deepseek.descriptive.adjustedPersistentFeedback,
      display: percent(deepseek.descriptive.adjustedPersistentFeedback),
      note: "DeepSeek exposure event minus held-sham event"
    }
  ];

  return (
    <section className="llm-feedback-panel" aria-labelledby="llm-feedback-title">
      <header>
        <span className="mono-label">FRONTIER LLM PILOTS / 32 FROZEN TASKS</span>
        <h3 id="llm-feedback-title">The changed shelf became a changed path.</h3>
        <p>
          Immediate activation and outcome-gated activation began from the same task.
          DeepSeek then ran two additional held trajectories without cache reuse, exposing
          how much divergence came from the model itself.
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

      <div className="llm-feedback-chain" aria-label="Observed mechanism chain">
        <span>temporary activity</span>
        <b>→</b>
        <span>changed recommendation</span>
        <b>→</b>
        <span>changed agent action</span>
        <b>→</b>
        <span>different next-task output</span>
      </div>

      <footer>
        <p>
          <strong>Observed:</strong> DeepSeek produced 11/64 exposed trace divergences,
          0/64 sham divergences, and 9/64 sham-adjusted persistent-feedback events.
        </p>
        <p>
          <strong>Boundary:</strong> MiMo shows the same descriptive direction, but it
          has not yet completed the matched sham arms. This is cross-provider pilot
          evidence, not the 360-task confirmatory result.
        </p>
      </footer>
    </section>
  );
}
