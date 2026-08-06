import type {
  CandidateMarginSummary,
  DeterministicRepairSummary,
  ForcedInspectionSummary
} from "../data";

export function LLMBehaviorFeedbackPanel({
  repair,
  forced,
  historicalMargin
}: {
  repair: DeterministicRepairSummary;
  forced: ForcedInspectionSummary;
  historicalMargin: CandidateMarginSummary;
}) {
  const oldProviderEvents =
    repair.providers.mimo.persistentResolvedActionEventCount +
    repair.providers.deepseek.persistentResolvedActionEventCount;

  return (
    <section className="llm-feedback-panel" aria-labelledby="llm-feedback-title">
      <header>
        <span className="mono-label">P0 METHOD AUDIT / CLAIM WITHDRAWN</span>
        <h3 id="llm-feedback-title">
          The 32-task pilot cannot support the action claim.
        </h3>
        <p>
          A source audit found three coupled problems: the required inspection
          removed that item from the next candidate list, tasks were enriched on
          the proposed mechanism, and the next-task outcome included consequences
          of different selected items. The old result is retained as an audit,
          not evidence.
        </p>
      </header>

      <div className="llm-feedback-repair">
        <header>
          <span className="mono-label">WHY IT FAILED</span>
          <h4>The treatment changed more than recommendation exposure.</h4>
          <p>
            Once the controller marked a recommendation as viewed, the legacy
            candidate builder excluded it. Immediate and held agents therefore
            did not receive the same selectable action set. That is a design
            confound, not a cosmetic implementation detail.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>Old provider-events</span>
            <strong>{oldProviderEvents}</strong>
            <p>recorded, but no longer used as a result</p>
          </article>
          <article>
            <span>Within-opportunity AUC</span>
            <strong>0.313</strong>
            <p>DeepSeek; exact one-sided p = 0.892</p>
          </article>
          <article>
            <span>Natural task frame</span>
            <strong>460</strong>
            <p>all frozen tasks, without mechanism enrichment</p>
          </article>
          <article>
            <span>New task-model units</span>
            <strong>920</strong>
            <p>SASRec and GRU on every task</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          The reported dominance association disappears inside the 15 enriched
          opportunity tasks: DeepSeek AUC 0.313, p = 0.892; MiMo AUC 0.231,
          p = 0.961. The mechanism claim has been removed rather than reworded.
        </p>
      </div>

      <div className="llm-feedback-boundary-grid">
        <article>
          <span className="mono-label">REPLACEMENT STUDY</span>
          <h4>Matched choices, symmetric repeats.</h4>
          <p>
            The v5 protocol sends identical candidate IDs to immediate and held
            arms. The inspected product remains selectable. Two calls per arm and
            a frozen Latin-square order separate an arm effect from repeated-call
            variation at temperature zero.
          </p>
          <dl>
            <div>
              <dt>Calls per unit</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Selectable inspections</dt>
              <dd>1,840/1,840</dd>
            </div>
          </dl>
        </article>

        <article>
          <span className="mono-label">MEASUREMENT BOUNDARY</span>
          <h4>Restored input state is not restored behavior.</h4>
          <p>
            The new primary endpoint is resolved-action distribution distance.
            It does not require next-task displacement. If two arms select
            different items, their later histories are expected to differ and
            cannot be used as evidence that removal failed.
          </p>
          <dl>
            <div>
              <dt>Old trace-only change</dt>
              <dd>{Math.round(forced.providers.mimo.wholeTraceDivergenceRate * 32)}/32</dd>
            </div>
            <div>
              <dt>Old margin support</dt>
              <dd>{historicalMargin.providers.deepseek.analyzableCount}/32</dd>
            </div>
          </dl>
        </article>
      </div>

      <footer>
        <p>
          Agent-mediated shopping is the setting, not an identified provenance
          mechanism. No usability, trust, human preference, production-retailer,
          deletion, or unlearning claim is made.
        </p>
        <p>
          Raw prompts, responses, item titles, reviews, and original identifiers
          remain outside the public artifacts.
        </p>
      </footer>
    </section>
  );
}
