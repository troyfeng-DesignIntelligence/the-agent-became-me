import type {
  CandidateMarginSummary,
  DeterministicRepairSummary,
  FeedbackActionEvaluation,
  FeedbackBridgeSummary,
  ForcedInspectionSummary,
  InstrumentAblationEvaluation,
  NaturalActionEvaluation
} from "../data";

function interval(value: { estimate: number; ci95: [number, number] }) {
  return `${value.estimate.toFixed(3)} [${value.ci95[0].toFixed(3)}, ${value.ci95[1].toFixed(3)}]`;
}

export function LLMBehaviorFeedbackPanel({
  repair,
  forced,
  historicalMargin,
  natural,
  ablation,
  feedbackBridge,
  feedbackAction
}: {
  repair: DeterministicRepairSummary;
  forced: ForcedInspectionSummary;
  historicalMargin: CandidateMarginSummary;
  natural: NaturalActionEvaluation;
  ablation: InstrumentAblationEvaluation;
  feedbackBridge: FeedbackBridgeSummary;
  feedbackAction: FeedbackActionEvaluation;
}) {
  const mimo = natural.providers.mimo;
  const deepseek = natural.providers.deepseek;
  const oldProviderEvents =
    repair.providers.mimo.persistentResolvedActionEventCount +
    repair.providers.deepseek.persistentResolvedActionEventCount;
  const validCalls = mimo.runApi.validActionCount + deepseek.runApi.validActionCount;
  const v7DeepSeek = ablation.providers.deepseek.estimates;
  const v7MiMo = ablation.providers.mimo.estimates;
  const bridgeDeepSeek = feedbackBridge.groups.deepseek;
  const downstream = feedbackAction.results["primary-feedback"];
  const downstreamControl = feedbackAction.results["identical-control"];

  return (
    <section className="llm-feedback-panel" aria-labelledby="llm-feedback-title">
      <header>
        <span className="mono-label">CONFIRMATORY V6 / NATURAL 460-TASK FRAME</span>
        <h3 id="llm-feedback-title">
          Activation timing shifted categorical outputs in the tested models.
        </h3>
        <p>
          Every task was evaluated with SASRec and GRU. Immediate and held arms
          received the same candidate IDs in the same order, and the inspected
          product remained selectable. Two separately issued calls per arm
          measured repeated-call variation under a stable-output assumption.
        </p>
      </header>

      <div className="llm-feedback-repair">
        <header>
          <span className="mono-label">PRIMARY RESULT</span>
          <h4>The bounded contrast recurred in both provider models.</h4>
          <p>
            The categorical energy-distance statistic subtracts within-arm
            disagreement from cross-arm disagreement. DeepSeek was the frozen
            primary provider; MiMo was the prespecified second provider. Both
            task-clustered intervals exclude zero.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>DeepSeek</span>
            <strong>{deepseek.estimates.overallActionDistributionDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {deepseek.estimates.overallActionDistributionDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>MiMo</span>
            <strong>{mimo.estimates.overallActionDistributionDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {mimo.estimates.overallActionDistributionDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>Natural opportunity</span>
            <strong>{(deepseek.estimates.naturalOpportunityRate.estimate * 100).toFixed(2)}%</strong>
            <p>40 of 920 task-model units</p>
          </article>
          <article>
            <span>Valid provider calls</span>
            <strong>{validCalls.toLocaleString()}</strong>
            <p>zero terminal failures</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          Conditional on a natural actionable opportunity, the estimate was {interval(deepseek.estimates.conditionalActionDistributionDistance)} for DeepSeek and {interval(mimo.estimates.conditionalActionDistributionDistance)} for MiMo. This conditional result is reported beside its 4.35% prevalence, not as a population-wide rate.
        </p>
      </div>

      <div className="llm-feedback-ablation">
        <header>
          <span className="mono-label">CONFIRMATORY V7 / NATURAL 460-TASK FRAME</span>
          <h4>Recommendation-order-induced agent choice divergence.</h4>
          <p>
            V7 removed explicit platform rank and inspection markers, held all
            candidate attributes fixed, and changed only the order in which the
            same candidates were served. The complete study passed both frozen
            DeepSeek gates and recurred in MiMo.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>DeepSeek / served order</span>
            <strong>{v7DeepSeek["served-order"].categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {v7DeepSeek["served-order"].categoricalEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>DeepSeek / masked</span>
            <strong>{v7DeepSeek["masked-control"].categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>{v7DeepSeek["served-order"].matchedCrossArmActionChangeCount}/1,840 served-order pairs changed</p>
          </article>
          <article>
            <span>MiMo / served order</span>
            <strong>{v7MiMo["served-order"].categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {v7MiMo["served-order"].categoricalEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>V7 decision</span>
            <strong>Passed</strong>
            <p>primary and masked-control gates</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          Candidate-order sensitivity itself is established in prior LLM
          ranking research. V7 contributes a controlled bridge from learned
          platform exposure to categorical agent action. V8 tests whether that
          action survives writeback as a later system effect.
        </p>
      </div>

      <div className="llm-feedback-ablation">
        <header>
          <span className="mono-label">CONFIRMATORY V8 / ONE-STEP FEEDBACK CHAIN</span>
          <h4>The choice changed the next shelf—and sometimes the next choice.</h4>
          <p>
            Each V7 selection was written back to the same frozen recommender.
            The held-out chronological next event then opened a second task.
            No task was selected because it had already diverged.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>Next-shelf distance</span>
            <strong>{bridgeDeepSeek["served-order"].slateEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {bridgeDeepSeek["served-order"].slateEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>Later-choice distance</span>
            <strong>{downstream.categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {downstream.categoricalEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>Byte-identical control</span>
            <strong>{downstreamControl.categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>226 independently selected task-model units</p>
          </article>
          <article>
            <span>Feedback decision</span>
            <strong>Passed</strong>
            <p>exposure, action, control, and reliability gates</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          Served-order choices changed at least one matched next slate in {(bridgeDeepSeek["served-order"].anyMatchedSlateChangeRate.estimate * 100).toFixed(1)}% of task-model units. The later matched action-change rate was {(downstream.matchedActionChangeRate.estimate * 100).toFixed(1)}%. This is a one-step model-system feedback result, not evidence of long-run amplification or human consequences.
        </p>
      </div>

      <div className="llm-feedback-boundary-grid">
        <article>
          <span className="mono-label">CONTROL CHECK</span>
          <h4>Repeated-call variation stayed below the arm contrast.</h4>
          <p>
            DeepSeek within-arm disagreement was 1.52% for immediate and 0.65%
            for held calls. MiMo was 1.74% and 2.28%. The mean same-layout
            immediate-versus-held divergence was about 7.5% in both families.
          </p>
          <dl>
            <div>
              <dt>DeepSeek quality Δ</dt>
              <dd>{deepseek.estimates.worstCaseQualityDifference.estimate.toFixed(4)}</dd>
            </div>
            <div>
              <dt>MiMo quality Δ</dt>
              <dd>+{mimo.estimates.worstCaseQualityDifference.estimate.toFixed(4)}</dd>
            </div>
          </dl>
        </article>

        <article>
          <span className="mono-label">P0 AUDIT</span>
          <h4>The old 32-task result remains withdrawn.</h4>
          <p>
            The legacy forced inspection changed candidate availability, and
            its pooled dominance AUC was driven by enriched sampling. A first
            natural-frame run also changed layout between A/B controls; it was
            invalidated and rerun with one shared layout.
          </p>
          <dl>
            <div>
              <dt>Old provider-events</dt>
              <dd>{oldProviderEvents}</dd>
            </div>
            <div>
              <dt>Old margin support</dt>
              <dd>{historicalMargin.providers.deepseek.analyzableCount}/32</dd>
            </div>
            <div>
              <dt>Old trace-only change</dt>
              <dd>{Math.round(forced.providers.mimo.wholeTraceDivergenceRate * 32)}/32</dd>
            </div>
          </dl>
        </article>
      </div>

      <footer>
        <p>
          The result concerns model choices from pseudonymous features in a
          research storefront. It does not identify human preference change,
          production-retailer effects, deletion, unlearning, or actor provenance.
        </p>
        <p>
          Every observed cross-arm transition in V6 and V7 was a
          selected-candidate swap; none changed between selection and abandonment.
          V8 used a held-out next-item intent proxy and derived features rather
          than a rendered commerce shelf.
        </p>
        <p>
          Raw prompts, responses, item titles, reviews, and original identifiers
          remain outside the public artifacts.
        </p>
      </footer>
    </section>
  );
}
