import { useEffect, useMemo, useState } from "react";
import {
  designImplications,
  findings,
  hero,
  limitations,
  references,
  researchQuestion,
  studyA,
  studyB,
  studyC
} from "./content";
import {
  CausalRibbon,
  ProfileStrata,
  ProvenanceBraid
} from "./components/EditorialVisuals";
import { InterfaceLab } from "./components/InterfaceLab";
import { useProjectData, type MetricSummary } from "./data";
import {
  AttributionMatrix,
  ConditionOutcomePanel,
  ProfileDivergenceChart,
  SensitivityHeatmap,
  profileDivergenceFromReplay,
  sensitivityData,
  traceHandlingMatrix
} from "./visualizations";

function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const range =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(range <= 0 ? 0 : window.scrollY / range);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return progress;
}

const percent = (value: number, digits = 0) =>
  `${(value * 100).toFixed(digits)}%`;

function condition(
  rows: MetricSummary[],
  id: string
): MetricSummary {
  const match = rows.find((row) => row.condition === id);
  if (!match) throw new Error(`Missing summary for ${id}`);
  return match;
}

interface PlateProps {
  children: React.ReactNode;
  index: string;
  label: string;
  meta?: string;
  note: string;
  title: string;
  variant?: "paper" | "ink" | "plain";
}

function Plate({
  children,
  index,
  label,
  meta,
  note,
  title,
  variant = "plain"
}: PlateProps) {
  return (
    <article className={`plate plate-${variant}`}>
      <header className="plate-heading">
        <div>
          <span className="plate-index">{index}</span>
          <span className="mono-label">{label}</span>
        </div>
        <h3>{title}</h3>
        <p>{note}</p>
        {meta ? <span className="plate-meta">{meta}</span> : null}
      </header>
      <div className="plate-body">{children}</div>
    </article>
  );
}

function Hero() {
  const [replayKey, setReplayKey] = useState(0);
  const base = import.meta.env.BASE_URL;
  return (
    <section className="hero section-shell" id="top">
      <span className="hero-exhibit" aria-hidden="true">
        EXHIBIT 001 / EVIDENCE ADMISSION
      </span>
      <div className="hero-copy">
        <span className="hero-eyebrow">
          <i aria-hidden="true" /> {hero.eyebrow}
        </span>
        <h1 aria-label="The Agent Became Me">
          <span>The Agent</span>
          <span>Became</span>
          <span className="identity-cut">Me</span>
        </h1>
        <p className="hero-deck">{hero.subtitle}</p>
        <p className="hero-summary">{hero.summary}</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#lab">
            {hero.primaryAction}
          </a>
          <a className="button button-secondary" href="#methods">
            {hero.secondaryAction}
          </a>
        </div>
        <div className="synthetic-disclosure">
          <span className="synthetic-dot" aria-hidden="true" />
          <span>
            <strong>Synthetic scenarios</strong>
            No human participant data
          </span>
        </div>
        <div className="hero-ledger" aria-label="Representative trace summary">
          <span>
            <strong>01</strong>
            temporary request
          </span>
          <span>
            <strong>17</strong>
            trace events
          </span>
          <span>
            <strong>01</strong>
            altered profile
          </span>
        </div>
      </div>

      <figure className="hero-reliquary">
        <div className="reliquary-frame">
          <img
            alt="A black specimen frame holding paper evidence and blue and red threads that converge into a dark fingerprint-like mass."
            decoding="async"
            fetchPriority="high"
            src={`${base}assets/evidence-reliquary.webp`}
          />
          <div className="reliquary-grid" aria-hidden="true" />
          <div className="reliquary-signals" key={replayKey} aria-hidden="true">
            <span className="signal signal-request">
              <i /> temporary task
            </span>
            <span className="signal signal-agent">
              <i /> delegated action
            </span>
            <span className="signal signal-profile">
              <i /> persistent identity
            </span>
          </div>
          <span className="reliquary-seal" aria-hidden="true">
            MISFILED
          </span>
        </div>
        <figcaption>
          <span>
            ART-DIRECTED GENERATED SPECIMEN · NOT STUDY DATA
          </span>
          <button
            className="replay-link"
            onClick={() => setReplayKey((key) => key + 1)}
            type="button"
          >
            ↻ Replay the evidence path
          </button>
        </figcaption>
      </figure>
      <a className="scroll-cue" href="#question">
        <span>SCROLL TO FOLLOW THE EVIDENCE</span>
        <i aria-hidden="true">↓</i>
      </a>
    </section>
  );
}

function TraceFieldInterlude() {
  const base = import.meta.env.BASE_URL;
  return (
    <section className="trace-field-interlude" aria-labelledby="trace-field-title">
      <img
        alt="Blue and red evidence threads pass through a black gate, then become tangled and layered into an archival record."
        loading="lazy"
        src={`${base}assets/trace-field.webp`}
      />
      <div className="trace-field-shade" aria-hidden="true" />
      <div className="trace-field-copy section-shell">
        <span className="mono-label">THE ADMISSION PROBLEM / 001</span>
        <h2 id="trace-field-title">
          One gate decides whether action becomes identity.
        </h2>
        <p>
          Before the gate, actor and intent remain distinct. After an
          actor-blind update, a temporary trace can harden into the principal’s
          enduring profile.
        </p>
      </div>
      <div className="trace-field-key section-shell" aria-hidden="true">
        <span><i className="key-blue" /> delegated evidence</span>
        <span><i className="key-red" /> principal record</span>
        <span><b>│</b> persistence gate</span>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <span className="mono-label">RECONSTRUCTING TRACE</span>
      <div className="loading-rule">
        <i />
      </div>
      <p>Loading the frozen experiment artifact…</p>
    </div>
  );
}

export function App() {
  const scrollProgress = useScrollProgress();
  const { summary, catalog, error, loading } = useProjectData();

  const evidence = useMemo(() => {
    if (!summary) return null;
    const actorBlind = condition(summary.overallA, "actor-blind");
    const loggedOnly = condition(summary.overallA, "logged-only");
    const matched = condition(summary.overallA, "matched-attenuation");
    const provenance = condition(summary.overallA, "provenance-aware");
    const scope = condition(summary.overallA, "scope-gated");
    const noUpdate = condition(summary.overallA, "no-update");
    const actionOnly = condition(summary.overallB, "action-only");
    const impactProxy = condition(summary.overallB, "impact-proxy");
    const quarantine = condition(
      summary.overallB,
      "impact-proxy-with-quarantine"
    );
    const stressNoUpdate = condition(summary.overallC, "no-update");
    const stressScope = condition(summary.overallC, "scope-gated");
    return {
      actorBlind,
      loggedOnly,
      matched,
      provenance,
      scope,
      noUpdate,
      actionOnly,
      impactProxy,
      quarantine,
      stressNoUpdate,
      stressScope,
      provenancePenaltyVsMatched:
        provenance.profileContamination / matched.profileContamination - 1,
      scopeReduction:
        1 - scope.profileContamination / actorBlind.profileContamination,
      quarantineReduction:
        1 -
        quarantine.profileContamination / impactProxy.profileContamination
    };
  }, [summary]);

  const base = import.meta.env.BASE_URL;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="site-mark" href="#top">
          <span>ACI / 01</span>
          The Agent Became Me
        </a>
        <div className="nav-links">
          <a href="#question">Question</a>
          <a href="#lab">Trace</a>
          <a href="#evidence">Evidence</a>
          <a href="#methods">Methods</a>
        </div>
        <span className="nav-status">
          <i /> reproducible artifact
        </span>
        <span
          aria-hidden="true"
          className="nav-progress"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </nav>

      <main id="main">
        <Hero />

        <section className="question-section section-shell" id="question">
          <div className="section-number">01</div>
          <div className="question-copy">
            <span className="section-kicker">{researchQuestion.label}</span>
            <h2>{researchQuestion.question}</h2>
            <div className="question-notes">
              <p>{researchQuestion.framing}</p>
              <p>{researchQuestion.contribution}</p>
            </div>
          </div>
          <aside className="margin-note">
            <span className="mono-label">CLAIM BOUNDARY</span>
            <p>{researchQuestion.noveltyBoundary}</p>
          </aside>
        </section>

        <section className="gap-section section-shell">
          <header className="section-header">
            <div>
              <span className="section-kicker">The delegation gap</span>
              <h2>A temporary task can leave a durable trace.</h2>
            </div>
            <p>
              The interface problem does not begin at checkout. It begins when
              a system decides whether delegated behavior should count as
              personal evidence.
            </p>
          </header>
          <CausalRibbon />
          <div className="provocation">
            <span aria-hidden="true">“</span>
            <p>
              Should an agent’s action count as evidence of{" "}
              <em>your</em> preference?
            </p>
          </div>
        </section>

        <TraceFieldInterlude />

        <section className="lab-section section-shell" id="lab">
          <div className="section-number">02</div>
          <header className="section-header lab-header">
            <div>
              <span className="section-kicker">One trace, six contracts</span>
              <h2>Change the rule. Keep the evidence locked.</h2>
            </div>
            <p>
              Scrub one frozen shopping trace through six update contracts.
              Scenario, policy, products, seed, and event order remain fixed.
            </p>
          </header>
          {loading && <LoadingState />}
          {error && (
            <div className="error-state" role="alert">
              <strong>Experiment artifact could not be loaded.</strong>
              <span>{error}</span>
            </div>
          )}
          {summary && catalog && (
            <InterfaceLab
              catalog={catalog}
              replay={summary.representative}
            />
          )}
        </section>

        {summary && evidence && (
          <section className="evidence-section" id="evidence">
            <div className="section-shell">
              <div className="section-number light">03</div>
              <header className="evidence-intro">
                <span className="section-kicker">Generated evidence</span>
                <h2>
                  Selective provenance did not beat a matched shrinkage
                  control.
                </h2>
                <p>
                  The added falsification control changed the conclusion.
                  These numbers describe an implemented synthetic protocol—not
                  people, platforms, or experienced consent.
                </p>
              </header>
              <div className="headline-findings">
                <div className="headline-stat">
                  <span>Provenance-specific penalty</span>
                  <strong>
                    +{percent(evidence.provenancePenaltyVsMatched, 0)}
                  </strong>
                  <p>mean divergence vs. matched update mass</p>
                </div>
                <div className="headline-stat">
                  <span>Idealized scope gate</span>
                  <strong>−{percent(evidence.scopeReduction, 0)}</strong>
                  <p>mean reference divergence vs. actor-blind</p>
                </div>
                <div className="headline-stat">
                  <span>Frozen task utility</span>
                  <strong>{evidence.actorBlind.taskUtility.toFixed(3)}</strong>
                  <p>unchanged across all Study A conditions</p>
                </div>
              </div>
            </div>

            <div className="plates section-shell">
              <Plate
                index="01"
                label="CAUSAL MECHANISM"
                meta="CONCEPTUAL SCHEMATIC · NOT AN OBSERVED TRACE"
                note="Interpretive distance grows between a human request and a persistent profile update."
                title="The delegation gap"
              >
                <CausalRibbon activeStage={3} />
              </Plate>

              <Plate
                index="02"
                label="CONDITION DISTRIBUTIONS"
                meta={`GENERATED · 4 SCENARIOS · 480 RUNS/CONDITION · ${summary.protocolVersion.toUpperCase()}`}
                note="Each card pools four synthetic scenarios, three policies, and 40 paired seeds. Whiskers are descriptive P10–P90 ranges."
                title="Six contracts over paired traces"
                variant="paper"
              >
                <div className="counterfactual-cards">
                  {[
                    {
                      id: "actor-blind",
                      letter: "U",
                      label: "Actor-blind",
                      tone: "error",
                      data: evidence.actorBlind
                    },
                    {
                      id: "logged-only",
                      letter: "L",
                      label: "Logged only",
                      tone: "neutral",
                      data: evidence.loggedOnly
                    },
                    {
                      id: "matched-attenuation",
                      letter: "M",
                      label: "Matched shrinkage",
                      tone: "neutral",
                      data: evidence.matched
                    },
                    {
                      id: "provenance-aware",
                      letter: "P",
                      label: "Provenance-aware",
                      tone: "provenance",
                      data: evidence.provenance
                    },
                    {
                      id: "scope-gated",
                      letter: "S",
                      label: "Scope-gated",
                      tone: "negotiated",
                      data: evidence.scope
                    },
                    {
                      id: "no-update",
                      letter: "0",
                      label: "No update",
                      tone: "neutral",
                      data: evidence.noUpdate
                    }
                  ].map((item) => (
                    <article className="counterfactual-card" key={item.id}>
                      <span className={`world-letter tone-${item.tone}`}>
                        {item.letter}
                      </span>
                      <h4>{item.label}</h4>
                      <div className="counterfactual-metric">
                        <strong>
                          {item.data.profileContamination.toFixed(3)}
                        </strong>
                        <span>mean reference divergence</span>
                      </div>
                      <div className="mini-range">
                        <span
                          className={`tone-${item.tone}`}
                          style={{
                            left: `${item.data.profileContaminationP10 * 200}%`,
                            width: `${
                              (item.data.profileContaminationP90 -
                                item.data.profileContaminationP10) *
                              200
                            }%`
                          }}
                        />
                      </div>
                      <small>
                        P10 {item.data.profileContaminationP10.toFixed(3)} · P90{" "}
                        {item.data.profileContaminationP90.toFixed(3)}
                      </small>
                    </article>
                  ))}
                </div>
              </Plate>

              <Plate
                index="03"
                label="PROFILE STRATA"
                meta={`REPRESENTATIVE · 1 TRACE · 17 EVENTS · ${summary.protocolVersion.toUpperCase()}`}
                note="Final trait weights retain a visible reference marker. Bars show the profile representation after 17 events."
                title="How one profile representation moved"
              >
                <ProfileStrata
                  profiles={[
                    {
                      id: "actor-blind",
                      label: "Actor-blind",
                      profile:
                        summary.representative.worlds["actor-blind"]
                          .finalProfile,
                      tone: "error"
                    },
                    {
                      id: "matched-attenuation",
                      label: "Matched shrinkage",
                      profile:
                        summary.representative.worlds["matched-attenuation"]
                          .finalProfile,
                      tone: "neutral"
                    },
                    {
                      id: "provenance-aware",
                      label: "Provenance-aware",
                      profile:
                        summary.representative.worlds["provenance-aware"]
                          .finalProfile,
                      tone: "provenance"
                    },
                    {
                      id: "scope-gated",
                      label: "Scope-gated",
                      profile:
                        summary.representative.worlds["scope-gated"]
                          .finalProfile,
                      tone: "negotiated"
                    },
                    {
                      id: "no-update",
                      label: "No update",
                      profile:
                        summary.representative.worlds["no-update"].finalProfile,
                      tone: "neutral"
                    }
                  ]}
                  reference={summary.representative.scenario.principalReference}
                />
              </Plate>

              <Plate
                index="04"
                label="PROVENANCE BRAID"
                meta={`REPRESENTATIVE · 17 RECEIPT-DERIVED LINKS · ${summary.protocolVersion.toUpperCase()}`}
                note="Each path follows the largest absolute signed trait delta for one event in the actor-blind replay; the exact ledger is available below."
                title="Where delegated evidence entered the profile"
                variant="paper"
              >
                <ProvenanceBraid replay={summary.representative} />
              </Plate>

              <Plate
                index="05"
                label="PROFILE DIVERGENCE"
                meta={`REPRESENTATIVE · 1 TRACE · 5 CONTRACTS · ${summary.protocolVersion.toUpperCase()}`}
                note="Normalized Euclidean distance from the fixed principal reference. The representative trace is identical across lines."
                title="How quickly the profile moved"
              >
                <ProfileDivergenceChart
                  note="Representative synthetic replay: Party snacks · exploratory policy · seed 17. Lines show deterministic state transitions, not inferential confidence intervals."
                  series={profileDivergenceFromReplay(summary.representative)}
                  subtitle="Distance from the reference profile before and after each delegated event."
                  title="Profile divergence across the representative trace"
                />
              </Plate>

              <Plate
                index="06"
                label="TRACE-HANDLING DIAGNOSTICS"
                meta={`GENERATED · 4 SCENARIOS · 480 RUNS/CONTRACT · ${summary.protocolVersion.toUpperCase()}`}
                note="All cells use one definition across contracts: recording errors, label errors, provenance use, or persistence rate."
                title="What each contract recorded and used"
                variant="paper"
              >
                <AttributionMatrix
                  columns={[
                    "actor-blind",
                    "logged-only",
                    "matched-attenuation",
                    "provenance-aware",
                    "scope-gated",
                    "no-update"
                  ]}
                  data={traceHandlingMatrix(summary.overallA)}
                  note="Actor and intent errors compare generated source fields with recorded fields. Provenance use is event-level: matched shrinkage uses an oracle-calibrated trace scalar but no selective event multiplier. None is a human judgment."
                  rowAxisLabel="Common diagnostic"
                  rows={[
                    "Actor-recording error",
                    "Intent-label error",
                    "Event provenance used",
                    "Events persisted"
                  ]}
                  subtitle="Mean event-level rates across four scenarios, three policies, and 40 paired seeds."
                  title="Trace handling by synthetic contract"
                  valueLabel="Event rate"
                />
              </Plate>

              <Plate
                index="07"
                label="SEPARATED OUTCOME DISTRIBUTIONS"
                meta={`GENERATED · STUDY A 2,880 RUNS · STUDY B 1,440 RUNS · ${summary.protocolVersion.toUpperCase()}`}
                note="The studies stay in separate panels because Study A freezes traces while Study B changes a behavior-side signal and a persistence-side contract."
                title="Reference divergence, utility, and modeled cost"
              >
                <div className="outcome-panels">
                  <ConditionOutcomePanel
                    note="No update is an explicit optimization floor for an initially aligned profile. Matched shrinkage controls for total update mass without using intent selectively."
                    rows={summary.overallA}
                    studyLabel="STUDY A · FROZEN TRACE"
                    title="Attribution-contract outcomes"
                  />
                  <ConditionOutcomePanel
                    note="The impact-proxy conditions share the same behavior traces. Their difference isolates the non-commit quarantine rule; cost is a modeled index, not measured burden."
                    rows={summary.overallB}
                    showCost
                    studyLabel="STUDY B · BUNDLED PROBES"
                    title="Signal and persistence outcomes"
                  />
                </div>
              </Plate>

              <Plate
                index="08"
                label="LEARNING-NEEDED COUNTEREXAMPLE"
                meta={`GENERATED · WEEKLY BREAKFAST · 720 RUNS · ${summary.protocolVersion.toUpperCase()}`}
                note="This stress test starts from the scenario’s disclosed, stale profile rather than the evaluator reference. It asks when preserving state can itself be wrong."
                title="No update is not a universal integrity strategy"
                variant="paper"
              >
                <ConditionOutcomePanel
                  note="One deliberately aligned task cannot establish external validity. It is included to falsify the simpler rule that less learning must always be better."
                  rows={summary.overallC}
                  studyLabel="STUDY C · STALE INITIAL PROFILE"
                  title="Learning-needed stress test"
                />
              </Plate>
            </div>
          </section>
        )}

        {summary && evidence && (
          <section className="studies-section section-shell">
            <div className="study-block">
              <header>
                <span className="study-label">{studyA.label}</span>
                <h2>{studyA.title}</h2>
                <p>{studyA.explanation}</p>
              </header>
              <div className="study-metrics">
                <span>
                  <strong>{studyA.runCount.toLocaleString()}</strong>
                  total runs
                </span>
                <span>
                  <strong>{studyA.runsPerCondition}</strong>
                  per condition
                </span>
                <span>
                  <strong>frozen</strong>
                  behavior trace
                </span>
              </div>
              <div className="condition-list">
                {studyA.conditions.map((item, index) => (
                  <article key={item.id}>
                    <span>A{index}</span>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="study-caution">{studyA.caution}</p>
            </div>

            <div className="study-block is-secondary">
              <header>
                <span className="study-label">{studyB.label}</span>
                <h2>{studyB.title}</h2>
                <p>{studyB.explanation}</p>
              </header>
              <div className="study-metrics">
                <span>
                  <strong>{studyB.runCount.toLocaleString()}</strong>
                  total runs
                </span>
                <span>
                  <strong>−{percent(evidence.quarantineReduction, 0)}</strong>
                  divergence with quarantine
                </span>
                <span>
                  <strong>+8</strong>
                  modeled cost index
                </span>
              </div>
              <div className="condition-list">
                {studyB.conditions.map((item, index) => (
                  <article key={item.id}>
                    <span>B{index}</span>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="study-caution">{studyB.caution}</p>
            </div>

            <div className="study-block is-tertiary">
              <header>
                <span className="study-label">{studyC.label}</span>
                <h2>{studyC.title}</h2>
                <p>{studyC.explanation}</p>
              </header>
              <div className="study-metrics">
                <span>
                  <strong>{studyC.runCount.toLocaleString()}</strong>
                  total runs
                </span>
                <span>
                  <strong>
                    {evidence.stressNoUpdate.profileContamination.toFixed(3)}
                  </strong>
                  no-update divergence
                </span>
                <span>
                  <strong>
                    {evidence.stressScope.profileContamination.toFixed(3)}
                  </strong>
                  scope-gated divergence
                </span>
              </div>
              <p className="study-caution">{studyC.caution}</p>
            </div>
          </section>
        )}

        <section className="findings-section section-shell">
          <div className="section-number">04</div>
          <header className="section-header">
            <div>
              <span className="section-kicker">What the testbed suggests</span>
              <h2>Four findings, each with a boundary.</h2>
            </div>
            <p>
              Measured outcomes stay separate from design implications. No
              result below is a claim about human trust, control, or identity.
            </p>
          </header>
          <div className="finding-list">
            {findings.map((finding, index) => (
              <article className="finding-row" key={finding.id}>
                <span className="finding-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="finding-main">
                  <span className="mono-label">{finding.kicker}</span>
                  <h3>{finding.title}</h3>
                  <p>{finding.body}</p>
                </div>
                <div className="finding-evidence">
                  {finding.evidence.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  <small>{finding.boundary}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="implications-section">
          <div className="section-shell">
            <div className="section-number light">05</div>
            <header className="implications-intro">
              <span className="section-kicker">Testable design hypotheses</span>
              <h2>
                The failed claim points to better experiments.
              </h2>
            </header>
            <div className="implication-grid">
              {designImplications.map((item, index) => (
                <article key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="methods-section section-shell" id="methods">
          <div className="section-number">06</div>
          <header className="section-header">
            <div>
              <span className="section-kicker">Methods, limits & source</span>
              <h2>Every visual has a path back to the rows.</h2>
            </div>
            <p>
              The site is the reader layer. The protocol, source snapshot,
              deterministic runner, tests, and full output remain inspectable.
            </p>
          </header>

          {summary && (
            <>
              <div className="method-ledger">
                <div>
                  <span>CHOICE ENVIRONMENT</span>
                  <strong>
                    {summary.catalog.productCount} Open Food Facts products
                  </strong>
                  <small>product metadata only · ODbL 1.0</small>
                </div>
                <div>
                  <span>FACTORIAL DESIGN</span>
                  <strong>
                    {summary.design.scenarioCount} scenarios ×{" "}
                    {summary.design.policies.length} policies
                  </strong>
                  <small>
                    {summary.design.seedsPerCell} paired seeds per cell
                  </small>
                </div>
                <div>
                  <span>BASELINE PARAMETERS</span>
                  <strong>
                    η {summary.design.baselineLearningRate.toFixed(2)} · noise{" "}
                    {percent(summary.design.baselineLabelNoise)}
                  </strong>
                  <small>declared in protocol.v1</small>
                </div>
                <div>
                  <span>GENERATED</span>
                  <strong>
                    {new Date(summary.generatedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </strong>
                  <small>deterministic JSON artifact</small>
                </div>
              </div>
              <div className="sensitivity-panel">
                <header>
                  <span className="mono-label">SENSITIVITY / FAILURE SURFACE</span>
                  <h3>
                    Label noise changed the mechanism in a non-monotonic way.
                  </h3>
                  <p>
                    Higher noise sometimes lowered divergence by suppressing
                    high-weight commit evidence. This is a failure analysis,
                    not a robustness claim. Each cell aggregates 240 runs.
                  </p>
                </header>
                <div>
                  <SensitivityHeatmap
                    data={sensitivityData(summary.sensitivity)}
                    metric="profileContamination"
                    note="Actor-blind and provenance-aware updating are compared over five label-noise values and four learning rates. P10–P90 values are available below; lower means can arise for the wrong mechanistic reason."
                    subtitle="Mean reference-profile divergence over the protocol-defined parameter grid."
                    title="Reference-divergence sensitivity"
                  />
                </div>
              </div>
            </>
          )}

          <div className="methods-grid">
            <article className="method-card method-protocol">
              <span className="mono-label">REPRODUCE</span>
              <h3>One command regenerates the evidence.</h3>
              <pre>
                <code>
                  <span>$</span> pnpm install --frozen-lockfile{"\n"}
                  <span>$</span> pnpm experiment{"\n"}
                  <span>$</span> pnpm check
                </code>
              </pre>
              <div className="artifact-links">
                <a href={`${base}results/v1/baseline.json`} download>
                  Download full rows <span>JSON ↓</span>
                </a>
                <a href={`${base}results/v1/summary.json`} download>
                  Download summary <span>JSON ↓</span>
                </a>
                <a href={`${base}data/open-food-facts.snapshot.json`} download>
                  Download catalog <span>JSON ↓</span>
                </a>
              </div>
            </article>

            <article className="method-card">
              <span className="mono-label">LIMITATIONS</span>
              <h3>What this project cannot tell us.</h3>
              <ol className="limitations-list">
                {limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </article>
          </div>

          <div className="references-block">
            <header>
              <span className="mono-label">COLLISION & REUSE MAP</span>
              <h3>Built beside prior work, not on top of an empty field.</h3>
              <p>
                The contribution is deliberately narrow. Existing simulators,
                provenance standards, recommendation agents, and scrutable
                profiles define the territory.
              </p>
            </header>
            <div className="reference-grid">
              {references.map((reference) => (
                <a
                  href={reference.url}
                  key={reference.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{reference.kind.replace("-", " ")}</span>
                  <h4>{reference.title}</h4>
                  <p>{reference.note}</p>
                  <small>
                    {reference.year ??
                      (reference.kind === "standard"
                        ? "standard"
                        : reference.kind === "data"
                          ? "dataset"
                          : reference.kind === "reuse"
                            ? "software"
                            : "prior work")}
                    {reference.license ? ` · ${reference.license}` : ""}
                    <b>↗</b>
                  </small>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <span className="footer-mark">ACI / 01</span>
          <h2>
            Before delegated action becomes profile evidence, provenance has
            to beat the simpler baselines.
          </h2>
        </div>
        <div className="footer-meta">
          <span>Independent portfolio research artifact</span>
          <span>Synthetic scenarios · No human participants</span>
          <span>MIT code · Open Food Facts ODbL metadata</span>
        </div>
        <a href="#top">Back to top ↑</a>
      </footer>
    </>
  );
}
