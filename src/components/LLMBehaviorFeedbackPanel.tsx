import type {
  CandidateMarginSummary,
  DeterministicRepairSummary,
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
  ablation
}: {
  repair: DeterministicRepairSummary;
  forced: ForcedInspectionSummary;
  historicalMargin: CandidateMarginSummary;
  natural: NaturalActionEvaluation;
  ablation: InstrumentAblationEvaluation;
}) {
  const mimo = natural.providers.mimo;
  const deepseek = natural.providers.deepseek;
  const oldProviderEvents =
    repair.providers.mimo.persistentResolvedActionEventCount +
    repair.providers.deepseek.persistentResolvedActionEventCount;
  const validCalls = mimo.runApi.validActionCount + deepseek.runApi.validActionCount;
  const v7DeepSeek = ablation.providers.deepseek.estimates;
  const v7MiMo = ablation.providers.mimo.estimates;

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
          <span className="mono-label">V7 / FROZEN 32-UNIT MECHANISM PILOT</span>
          <h4>Candidate order survived the metadata ablation.</h4>
          <p>
            V7 removed explicit platform rank and inspection markers, held all
            candidate attributes fixed, and changed only the order in which the
            same candidates were served. The pilot passed its prespecified
            scale-up gate; it did not pass DeepSeek&apos;s full confirmatory interval
            gate.
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
            <p>{v7DeepSeek["served-order"].matchedCrossArmActionChangeCount}/64 served-order pairs changed</p>
          </article>
          <article>
            <span>MiMo / served order</span>
            <strong>{v7MiMo["served-order"].categoricalEnergyDistance.estimate.toFixed(3)}</strong>
            <p>95% CI {v7MiMo["served-order"].categoricalEnergyDistance.ci95.map((value) => value.toFixed(3)).join(" to ")}</p>
          </article>
          <article>
            <span>Pilot decision</span>
            <strong>Scale</strong>
            <p>run the full natural-frame V7</p>
          </article>
        </div>

        <p className="llm-feedback-repair__note">
          The inspection marker also moved outputs. V6 therefore remains a
          composite prompt-instrument result. V7 only establishes that an
          order-based explanation is strong enough to test at full scale.
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
          Every observed cross-arm transition in V6 and the V7 pilot was a
          selected-candidate swap; none changed between selection and abandonment.
          Neither study used a rendered commerce shelf.
        </p>
        <p>
          Raw prompts, responses, item titles, reviews, and original identifiers
          remain outside the public artifacts.
        </p>
      </footer>
    </section>
  );
}
