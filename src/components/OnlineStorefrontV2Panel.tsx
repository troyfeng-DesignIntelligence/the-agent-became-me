import type { OnlineStorefrontV2Summary } from "../data";
import "./online-storefront-v2-panel.css";

const policyNotes = [
  ["01", "No memory", "No event log, task-local state, or platform activation."],
  ["02", "Logged, inert", "An audit record exists but cannot affect retrieval or ranking."],
  ["03", "Immediate, then remove", "Task evidence reaches SASRec context before the outcome."],
  ["04", "Held until outcome", "Task-local retrieval stays active; platform context waits."]
] as const;

export function OnlineStorefrontV2Panel({
  summary
}: {
  summary: OnlineStorefrontV2Summary;
}) {
  const fixed = summary.confirmatory.fixedTrace;
  const free = summary.confirmatory.freeRunning;
  const base = import.meta.env.BASE_URL;
  const modelStoreUrl = `${base}?view=storefront-v2&mode=free-running&phase=task-in-progress`;

  return (
    <section className="online-v2-study" aria-labelledby="online-v2-title">
      <header>
        <div>
          <span className="mono-label">CONFIRMATORY V2 / TRAINED MODEL / 460 TASKS</span>
          <h3 id="online-v2-title">
            Four contracts separate logging from recommendation activation.
          </h3>
        </div>
        <p>
          The experiment keeps histories, checkpoint seeds, and agent policies
          fixed. One analysis holds the trace constant; the other lets the agent
          react to the changed shelf.
        </p>
      </header>

      <div className="online-v2-scorecard">
        <article>
          <span>FIXED TRACE / T1 DISPLACEMENT</span>
          <strong>{fixed.primaryT1ImmediateHeldDisplacement.estimate.toFixed(3)}</strong>
          <p>
            95% CI [{fixed.primaryT1ImmediateHeldDisplacement.lower95.toFixed(3)}, {" "}
            {fixed.primaryT1ImmediateHeldDisplacement.upper95.toFixed(3)}]
          </p>
        </article>
        <article>
          <span>FREE RUN / TRACE DIVERGENCE</span>
          <strong>{(free.traceDivergenceRate.estimate * 100).toFixed(1)}%</strong>
          <p>
            95% CI [{(free.traceDivergenceRate.lower95 * 100).toFixed(1)}%, {" "}
            {(free.traceDivergenceRate.upper95 * 100).toFixed(1)}%]
          </p>
        </article>
        <dl>
          <div><dt>Condition rows</dt><dd>{summary.design.conditionRowCount.toLocaleString()}</dd></div>
          <div><dt>Paired contrasts</dt><dd>{summary.design.pairedContrastRowCount.toLocaleString()}</dd></div>
          <div><dt>T2 / T3 upper bound</dt><dd>0.000 / 0.000</dd></div>
          <div><dt>Empty slates</dt><dd>{summary.failuresAndNegativeCases.emptySlateCount}</dd></div>
        </dl>
      </div>

      <div className="online-v2-contracts" aria-label="Evidence lifecycle conditions">
        {policyNotes.map(([index, title, note]) => (
          <article key={index}>
            <span>{index}</span>
            <h4>{title}</h4>
            <p>{note}</p>
          </article>
        ))}
      </div>

      <div className="online-v2-agents">
        {Object.entries(summary.descriptive.byAgentConfig).map(([name, row]) => (
          <article key={name}>
            <header><span>{name.replaceAll("-", " ")}</span><b>{(row.freeTraceDivergenceRate * 100).toFixed(1)}%</b></header>
            <div><i style={{ width: `${row.freeTraceDivergenceRate * 100}%` }} /></div>
            <p>free-running traces diverged; fixed T1 displacement {row.fixedT1Displacement.toFixed(3)}</p>
          </article>
        ))}
      </div>

      <footer>
        <div>
          <p>The fixed-trace lower bound exceeded 0.15. Both agent policies reproduced the shelf effect, while the exploration-first policy produced more trajectory divergence.</p>
          <p>The storefront is a research replay using trained checkpoints. It is not a production commerce platform.</p>
        </div>
        <a href={modelStoreUrl}>Open the model-backed store →</a>
      </footer>
    </section>
  );
}
