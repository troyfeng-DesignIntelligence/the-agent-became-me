import type { DelegatedActivationSummary } from "../data";

const checkpoints = [
  { id: "T0", label: "Task start", state: "same" },
  { id: "T1", label: "In progress", state: "different" },
  { id: "T2", label: "Outcome resolved", state: "same" },
  { id: "T3", label: "Next task", state: "same" }
] as const;

export function DelegatedActivationPanel({
  summary
}: {
  summary: DelegatedActivationSummary;
}) {
  const effect = summary.pooledUncertainty.inProgressDisplacementAt10;
  const selected = summary.categories.reduce(
    (total, category) => total + category.selectedTaskCount,
    0
  );
  const abandoned = summary.categories.reduce(
    (total, category) => total + category.abandonedTaskCount,
    0
  );
  const localBenefitCategories = summary.categories.filter(
    (category) => category.meanSelectedUtility > category.noLocalMeanSelectedUtility
  ).length;
  const base = import.meta.env.BASE_URL;
  const storefrontUrl = `${base}?view=storefront&task=cereal-selected&arm=held`;

  return (
    <section className="activation-study" aria-labelledby="activation-study-title">
      <header>
        <div>
          <span className="mono-label">ACTIVATION TIMING / 320 AGENT TASKS</span>
          <h3 id="activation-study-title">
            The final profile matched. The recommendations shown along the way did not.
          </h3>
        </div>
        <p>
          A shopping agent searched, viewed, requested task-local recommendations,
          compared, and then selected or abandoned. Each realized trace was replayed
          with immediate platform activation and with a hold until the outcome was known.
        </p>
      </header>

      <div className="activation-scorecard">
        <article>
          <span>IN-PROGRESS TOP-10 DISPLACEMENT</span>
          <strong>{effect.estimate.toFixed(3)}</strong>
          <p>95% bootstrap interval [{effect.lower95.toFixed(3)}, {effect.upper95.toFixed(3)}]</p>
        </article>
        <dl>
          <div><dt>Paired tasks</dt><dd>{summary.design.taskCount}</dd></div>
          <div><dt>Selected / abandoned</dt><dd>{selected} / {abandoned}</dd></div>
          <div><dt>Positive category intervals</dt><dd>{summary.observedComparisons.positiveInProgressIntervalCategoryCount} / 4</dd></div>
          <div><dt>Resolved + next-task mismatches</dt><dd>0</dd></div>
        </dl>
      </div>

      <div className="activation-timeline" aria-label="Paired recommendation checkpoints">
        {checkpoints.map((checkpoint) => (
          <article className={checkpoint.state === "different" ? "is-different" : "is-same"} key={checkpoint.id}>
            <span>{checkpoint.id}</span>
            <h4>{checkpoint.label}</h4>
            <strong>{checkpoint.state === "different" ? "rankings diverge" : "rankings match"}</strong>
          </article>
        ))}
      </div>

      <div className="activation-evidence">
        <figure>
          <img
            alt="Redacted recommendation timelines for a selected shopping-agent task, comparing immediate activation with holding evidence until resolution."
            loading="lazy"
            src={`${base}evidence/delegated-activation/v1/selected-timeline.png`}
          />
          <figcaption><span>SELECTED TASK</span> Both conditions commit the same selected outcome at T2.</figcaption>
        </figure>
        <figure>
          <img
            alt="Redacted recommendation timelines for an abandoned shopping-agent task, comparing immediate activation with holding evidence until resolution."
            loading="lazy"
            src={`${base}evidence/delegated-activation/v1/abandoned-timeline.png`}
          />
          <figcaption><span>ABANDONED TASK</span> Immediate activation changes T1 before removal; staged evidence is discarded.</figcaption>
        </figure>
      </div>

      <div className="activation-utility">
        <div>
          <span className="mono-label">CURRENT-TASK CHECK</span>
          <strong>0.000</strong>
          <p>maximum task-utility difference between activation conditions</p>
        </div>
        <p>
          Platform-profile staging did not disable the agent's task-local state.
          Every trace consumed task-local recommendations, and they improved selected-item
          utility in {localBenefitCategories} of four category diagnostics.
        </p>
      </div>

      <footer>
        <p>
          <strong>Observed:</strong> activation timing changed pending-task recommendations
          under a matched final state, while task-local agent utility remained identical.
        </p>
        <p>
          <strong>Boundary:</strong> this is an offline deterministic agent and frozen SASRec
          testbed—not Amazon.com, a deployed shopping agent, trained-model unlearning, or a human study.
        </p>
        <a className="activation-store-link" href={storefrontUrl}>
          Open the online research store →
        </a>
      </footer>
    </section>
  );
}
