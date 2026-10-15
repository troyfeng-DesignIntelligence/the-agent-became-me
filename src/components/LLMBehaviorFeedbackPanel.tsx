import type {
  CandidateMarginSummary,
  DeterministicRepairSummary,
  FeedbackActionEvaluation,
  FeedbackBridgeSummary,
  ForcedInspectionSummary,
  InstrumentAblationEvaluation,
  NaturalActionEvaluation,
  NaturalLanguagePolicyEvaluation
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
  feedbackAction,
  mimoFeedbackAction,
  naturalLanguagePolicy
}: {
  repair: DeterministicRepairSummary;
  forced: ForcedInspectionSummary;
  historicalMargin: CandidateMarginSummary;
  natural: NaturalActionEvaluation;
  ablation: InstrumentAblationEvaluation;
  feedbackBridge: FeedbackBridgeSummary;
  feedbackAction: FeedbackActionEvaluation;
  mimoFeedbackAction: FeedbackActionEvaluation;
  naturalLanguagePolicy: NaturalLanguagePolicyEvaluation;
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
  const bridgeMiMo = feedbackBridge.groups.mimo;
  const deepseekDownstream = feedbackAction.results["primary-feedback"];
  const deepseekDownstreamControl = feedbackAction.results["identical-control"];
  const mimoDownstream = mimoFeedbackAction.results["primary-feedback"];
  const mimoDownstreamControl = mimoFeedbackAction.results["identical-control"];
  const productDeepSeek = naturalLanguagePolicy.results.deepseek.estimates;
  const productMiMo = naturalLanguagePolicy.results.mimo.estimates;

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
          <span className="mono-label">CONFIRMATORY / ONE-STEP FEEDBACK CHAIN</span>
          <h4>The choice changed the next shelf—and sometimes the next choice.</h4>
          <p>
            Each V7 selection was written back to the same frozen recommender.
            The held-out chronological next event then opened a second task.
            No task was selected because it had already diverged. A frozen
            four-row cyclic Latin square counterbalanced the four downstream
            calls within category, recommender, and mode strata.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>DeepSeek / later choice</span>
            <strong>{deepseekDownstream.categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {deepseekDownstream.categoricalEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>MiMo / later choice</span>
            <strong>{mimoDownstream.categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {mimoDownstream.categoricalEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>Byte-identical controls</span>
            <strong>{deepseekDownstreamControl.categoricalEnergyDistance.estimate.toFixed(3)} / {mimoDownstreamControl.categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>226 units per provider; every call-position comparison was zero</p>
          </article>
          <article>
            <span>Feedback decision</span>
            <strong>Passed</strong>
            <p>exposure, action, order-balance, control, and reliability gates</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          DeepSeek- and MiMo-sourced choices produced next-shelf distances of {bridgeDeepSeek["served-order"].slateEnergyDistance.estimate.toFixed(3)} and {bridgeMiMo["served-order"].slateEnergyDistance.estimate.toFixed(3)}. Later matched action-change rates were {(deepseekDownstream.matchedActionChangeRate.estimate * 100).toFixed(1)}% and {(mimoDownstream.matchedActionChangeRate.estimate * 100).toFixed(1)}%. MiMo's provider-level interval excluded zero, but its SASRec-only interval did not. This is a one-step model-system result, not evidence of long-run amplification or human consequences.
        </p>
      </div>

      <div className="llm-feedback-ablation">
        <header>
          <span className="mono-label">PRODUCT-LANGUAGE EXTENSION / 64 FROZEN TASKS</span>
          <h4>Order sensitivity survived ordinary shopping language; amplification remains unresolved.</h4>
          <p>
            Both providers received the same cleaned titles, brands, and prices
            in arm-specific order. Private benchmark scores compared immediate
            write-then-delete with holding until outcome, and a three-step replay
            compared selected events with one deterministic matched-random
            realization. Of 128 task-model units, 60 contained a feasible item.
          </p>
        </header>

        <div className="llm-feedback-repair__grid">
          <article>
            <span>DeepSeek / order distance</span>
            <strong>{productDeepSeek.selectionDivergence.estimate.toFixed(3)}</strong>
            <p>95% CI {productDeepSeek.selectionDivergence.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>MiMo / order distance</span>
            <strong>{productMiMo.selectionDivergence.estimate.toFixed(3)}</strong>
            <p>95% CI {productMiMo.selectionDivergence.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>Holding / success Δ</span>
            <strong>+{productDeepSeek.heldMinusImmediateTaskSuccess.estimate.toFixed(3)} / +{productMiMo.heldMinusImmediateTaskSuccess.estimate.toFixed(3)}</strong>
            <p>both intervals include zero</p>
          </article>
          <article>
            <span>Step 3 vs random</span>
            <strong>{productDeepSeek.multistep.step3.observedMinusRandom.estimate.toFixed(3)} / {productMiMo.multistep.step3.observedMinusRandom.estimate.toFixed(3)}</strong>
            <p>one matched random realization</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          Selected-event point estimates did not consistently exceed this
          random realization, but assignment uncertainty was not integrated.
          The result establishes neither equivalence nor absence of
          amplification. Later steps use a fixed policy, and the benchmark
          score is not human utility.
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
          The confirmatory feedback endpoint used a held-out next-item proxy and
          derived features. The product-language extension used cleaned metadata
          but remained a small benchmark without human participants.
        </p>
        <p>
          Raw prompts, responses, item titles, reviews, and original identifiers
          remain outside the public artifacts.
        </p>
      </footer>
    </section>
  );
}
