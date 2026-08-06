import type { CrossLlmPilotSummary, MiMoLlmPilotSummary } from "../data";

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function LLMBehaviorFeedbackPanel({
  originalMimo,
  matchedMimo,
  deepseek
}: {
  originalMimo: MiMoLlmPilotSummary;
  matchedMimo: CrossLlmPilotSummary;
  deepseek: CrossLlmPilotSummary;
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
        <b>→</b>
        <span>same shelf displacement</span>
        <b>→</b>
        <span>different model response</span>
        <b>→</b>
        <span>provider-contingent path</span>
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
          supports a model-contingent boundary, not cross-LLM replication.
        </p>
      </footer>
    </section>
  );
}
