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
  const mimo = repair.providers.mimo;
  const deepseek = repair.providers.deepseek;
  const eventCount =
    mimo.persistentResolvedActionEventCount +
    deepseek.persistentResolvedActionEventCount;
  const opportunityEventCount =
    mimo.eventCountOnOpportunityChangedTasks +
    deepseek.eventCountOnOpportunityChangedTasks;

  return (
    <section className="llm-feedback-panel" aria-labelledby="llm-feedback-title">
      <header>
        <span className="mono-label">DETERMINISTIC LLM PILOT / 32 TASKS</span>
        <h3 id="llm-feedback-title">
          Action changes appeared in one part of the task set.
        </h3>
        <p>
          The pilot compared immediate activation with an outcome-gated hold.
          Two additional held calls measured ordinary model variation. Tasks,
          shelves, prompts, and decoding settings were fixed before the calls.
        </p>
      </header>

      <div className="llm-feedback-repair">
        <header>
          <span className="mono-label">PRIMARY RESULT</span>
          <h4>Every exposure event had a changed choice opportunity.</h4>
          <p>
            The 32 tasks were selected without model outcomes from a pool of 460.
            Fifteen were chosen because activation changed the actionable candidate
            opportunity. This makes the pilot a mechanism test, not a prevalence study.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>DeepSeek</span>
            <strong>7 / 32</strong>
            <p>resolved-action events; 1/32 in sham</p>
          </article>
          <article>
            <span>MiMo</span>
            <strong>6 / 32</strong>
            <p>resolved-action events; 0/32 in sham</p>
          </article>
          <article>
            <span>Opportunity tasks</span>
            <strong>{opportunityEventCount} / {eventCount}</strong>
            <p>exposure events found inside the opportunity subset</p>
          </article>
          <article>
            <span>Sent-state audit</span>
            <strong>32 / 32</strong>
            <p>predictor and decisions matched for each provider</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          DeepSeek was the frozen primary test: AUC {deepseek.mechanismAuc.toFixed(3)},
          exact p = {deepseek.oneSidedExactPermutationP.toFixed(4)}. MiMo pointed in
          the same direction: AUC {mimo.mechanismAuc.toFixed(3)}, exact p = {mimo.oneSidedExactPermutationP.toFixed(4)}.
          Lower dominance scores meant that the leading candidates were less separated
          before the model decided.
        </p>
      </div>

      <div className="llm-feedback-boundary-grid">
        <article>
          <span className="mono-label">MEASUREMENT CHOICE</span>
          <h4>Browsing and deciding are different outcomes.</h4>
          <p>
            In an earlier controller probe, a required recommendation view changed
            MiMo&apos;s trace in 24/32 pairs but changed its selected-item or abandon
            outcome in 0/32. The paper therefore counts resolved actions, not every
            difference in browsing history.
          </p>
          <dl>
            <div>
              <dt>Trace changed</dt>
              <dd>{Math.round(forced.providers.mimo.wholeTraceDivergenceRate * 32)}/32</dd>
            </div>
            <div>
              <dt>Decision changed</dt>
              <dd>0/32</dd>
            </div>
          </dl>
        </article>

        <article>
          <span className="mono-label">AUDIT TRAIL</span>
          <h4>The failed measurements stay visible.</h4>
          <p>
            The first utility margin covered only {historicalMargin.providers.deepseek.analyzableCount}/32
            tasks and had AUC {historicalMargin.providers.deepseek.marginAuc?.toFixed(2)}.
            The historical recommender also had dropout active at inference. Those
            runs explain the redesign, but they are not evidence for the repaired result.
          </p>
          <dl>
            <div>
              <dt>Old margin support</dt>
              <dd>{historicalMargin.providers.deepseek.analyzableCount}/32</dd>
            </div>
            <div>
              <dt>Old margin AUC</dt>
              <dd>{historicalMargin.providers.deepseek.marginAuc?.toFixed(2)}</dd>
            </div>
          </dl>
        </article>
      </div>

      <footer>
        <p>
          The result applies to an opportunity-enriched research storefront. It
          does not estimate ordinary task frequency or human preference change.
        </p>
        <p>
          Raw prompts, responses, item titles, reviews, and original identifiers
          are excluded from the public artifacts.
        </p>
      </footer>
    </section>
  );
}
