import { useEffect, useMemo, useState } from "react";
import {
  designImplications,
  findings,
  hero,
  limitations,
  references,
  researchQuestion,
  studyA,
  studyB
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
  ProfileDivergenceChart,
  SensitivityHeatmap,
  UtilityIntegrityTradeoff,
  attributionMatrixFromCells,
  profileDivergenceFromReplay,
  sensitivityData,
  utilityIntegrityFromMetrics
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
  note: string;
  title: string;
  variant?: "paper" | "ink" | "plain";
}

function Plate({
  children,
  index,
  label,
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
      </header>
      <div className="plate-body">{children}</div>
    </article>
  );
}

function Hero() {
  const [replayKey, setReplayKey] = useState(0);
  return (
    <section className="hero section-shell" id="top">
      <div className="hero-copy">
        <span className="hero-eyebrow">
          <i aria-hidden="true" /> {hero.eyebrow}
        </span>
        <h1>
          <span>The Agent</span>
          <span>
            Became{" "}
            <em className="misregistered-word" data-shadow="Me">
              Me
            </em>
          </span>
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
      </div>

      <div className="hero-artifact">
        <div className="artifact-meta">
          <span>DETERMINISTIC REPLAY</span>
          <span>PARTY-SNACKS / SEED 17</span>
        </div>
        <div className="hero-system" key={replayKey}>
          <article className="system-column system-human">
            <header>
              <span>01</span>
              <strong>What you meant</strong>
            </header>
            <blockquote>
              “Choose crowd-pleasing snacks for a children’s party. Avoid
              peanuts. This is a one-off purchase.”
            </blockquote>
            <span className="scope-stamp">TASK-SCOPED</span>
          </article>

          <div className="system-transfer" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <article className="system-column system-agent">
            <header>
              <span>02</span>
              <strong>What the agent did</strong>
            </header>
            <ol className="hero-trace-list">
              <li>
                <span>view</span>
                08 candidates
              </li>
              <li>
                <span>compare</span>
                04 products
              </li>
              <li>
                <span>shortlist</span>
                03 products
              </li>
              <li>
                <span>purchase</span>
                02 products
              </li>
            </ol>
            <span className="scope-stamp agent-stamp">AGENT ACTOR</span>
          </article>

          <div className="system-transfer is-error" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <article className="system-column system-profile">
            <header>
              <span>03</span>
              <strong>What the platform learned</strong>
            </header>
            <div className="hero-inferences">
              <span>
                <small>low processing</small>
                <strong>−63 pp</strong>
              </span>
              <span>
                <small>indulgence</small>
                <strong>+39 pp</strong>
              </span>
              <span>
                <small>plant-based</small>
                <strong>+16 pp</strong>
              </span>
            </div>
            <span className="scope-stamp error-stamp">WRITTEN AS “YOU”</span>
          </article>
        </div>
        <div className="artifact-footer">
          <span>
            One request <b>→</b> 17 trace events <b>→</b> one altered profile
          </span>
          <button
            className="replay-link"
            onClick={() => setReplayKey((key) => key + 1)}
            type="button"
          >
            ↻ Replay the misattribution
          </button>
        </div>
      </div>
      <a className="scroll-cue" href="#question">
        <span>SCROLL TO FOLLOW THE EVIDENCE</span>
        <i aria-hidden="true">↓</i>
      </a>
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
    const provenance = condition(summary.overallA, "provenance-aware");
    const approval = condition(summary.overallA, "approval-gated");
    const actionOnly = condition(summary.overallB, "action-only");
    const preview = condition(summary.overallB, "impact-preview");
    const repair = condition(summary.overallB, "preview-and-repair");
    return {
      actorBlind,
      loggedOnly,
      provenance,
      approval,
      actionOnly,
      preview,
      repair,
      provenanceReduction:
        1 -
        provenance.profileContamination / actorBlind.profileContamination,
      approvalReduction:
        1 - approval.profileContamination / actorBlind.profileContamination,
      repairReduction:
        1 - repair.profileContamination / actionOnly.profileContamination
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

        <section className="lab-section section-shell" id="lab">
          <div className="section-number">02</div>
          <header className="section-header lab-header">
            <div>
              <span className="section-kicker">One trace, three interfaces</span>
              <h2>Change the rule. Keep the evidence locked.</h2>
            </div>
            <p>
              Scrub one frozen shopping trace through three update contracts.
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
                  Provenance mattered only when it changed what the updater
                  was allowed to learn.
                </h2>
                <p>
                  These numbers describe a registered synthetic testbed—not
                  people, platforms, or experienced consent.
                </p>
              </header>
              <div className="headline-findings">
                <div className="headline-stat">
                  <span>Operational provenance</span>
                  <strong>
                    −{percent(evidence.provenanceReduction, 0)}
                  </strong>
                  <p>mean profile contamination vs. actor-blind</p>
                </div>
                <div className="headline-stat">
                  <span>Approval-gated scope</span>
                  <strong>−{percent(evidence.approvalReduction, 0)}</strong>
                  <p>mean profile contamination vs. actor-blind</p>
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
                note="Interpretive distance grows between a human request and a persistent profile update."
                title="The delegation gap"
              >
                <CausalRibbon activeStage={3} />
              </Plate>

              <Plate
                index="02"
                label="COUNTERFACTUAL WORLDS"
                note="The same representative trace is replayed; only the attribution contract changes."
                title="Three interfaces, one trace"
                variant="paper"
              >
                <div className="counterfactual-cards">
                  {[
                    {
                      id: "actor-blind",
                      letter: "U",
                      label: "Unmarked",
                      tone: "error",
                      data: evidence.actorBlind
                    },
                    {
                      id: "provenance-aware",
                      letter: "P",
                      label: "Provenance-aware",
                      tone: "provenance",
                      data: evidence.provenance
                    },
                    {
                      id: "approval-gated",
                      letter: "N",
                      label: "Approval-gated",
                      tone: "negotiated",
                      data: evidence.approval
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
                        <span>mean contamination</span>
                      </div>
                      <div className="mini-range">
                        <span
                          className={`tone-${item.tone}`}
                          style={{
                            left: `${item.data.profileContaminationP10 * 100}%`,
                            width: `${
                              (item.data.profileContaminationP90 -
                                item.data.profileContaminationP10) *
                              100
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
                note="Final trait weights retain a visible reference marker. Bars show the learned profile after 17 events."
                title="How the profile was rewritten"
              >
                <ProfileStrata
                  profiles={[
                    {
                      id: "actor-blind",
                      label: "Unmarked",
                      profile:
                        summary.representative.worlds["actor-blind"]
                          .finalProfile,
                      tone: "error"
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
                      id: "approval-gated",
                      label: "Approval-gated",
                      profile:
                        summary.representative.worlds["approval-gated"]
                          .finalProfile,
                      tone: "negotiated"
                    }
                  ]}
                  reference={summary.representative.scenario.principalReference}
                />
              </Plate>

              <Plate
                index="04"
                label="PROVENANCE BRAID"
                note="This representative braid follows seven exploration events into five profile traits."
                title="Where the actor label breaks"
                variant="paper"
              >
                <ProvenanceBraid replay={summary.representative} />
              </Plate>

              <Plate
                index="05"
                label="PROFILE DIVERGENCE"
                note="Normalized Euclidean distance from the fixed principal reference. The representative trace is identical across lines."
                title="How quickly the profile moved"
              >
                <ProfileDivergenceChart
                  note="Representative synthetic replay: Party snacks · exploratory policy · seed 17. Lines show deterministic paths, not inferential confidence intervals."
                  series={profileDivergenceFromReplay(
                    summary.representative
                  )}
                  subtitle="Distance from the reference profile after each delegated interaction."
                  title="Profile divergence across the representative trace"
                />
              </Plate>

              <Plate
                index="06"
                label="ATTRIBUTION OUTCOMES"
                note="Each cell aggregates 120 runs across three transparent agent policies. Exact rates remain available below the figure."
                title="Errors by scenario and contract"
                variant="paper"
              >
                <AttributionMatrix
                  columns={[
                    "actor-blind",
                    "logged-only",
                    "provenance-aware",
                    "approval-gated"
                  ]}
                  data={attributionMatrixFromCells(summary.cellsA)}
                  note="Attribution error compares the recorded actor and, when operationalized, the observed intent with the generated event source. It does not measure a human judgment."
                  subtitle="Mean event-level attribution error across 40 paired seeds per scenario–policy cell."
                  title="Attribution error by synthetic scenario"
                />
              </Plate>

              <Plate
                index="07"
                label="DESIGN TRADE-OFF FIELD"
                note="Higher is better on both axes. Point area represents modeled interaction cost; it is not human effort."
                title="Task utility versus profile integrity"
              >
                <UtilityIntegrityTradeoff
                  data={[
                    ...utilityIntegrityFromMetrics(
                      summary.overallA,
                      "Study A"
                    ),
                    ...utilityIntegrityFromMetrics(
                      summary.overallB,
                      "Study B"
                    )
                  ]}
                  note="Study A freezes behavior; Study B permits interface affordances to alter it. Their points share a descriptive field but are not one pooled causal comparison."
                  subtitle="Generated condition means; profile integrity is one minus normalized contamination."
                  title="Task utility and profile integrity by condition"
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
                  <strong>−{percent(evidence.repairReduction, 0)}</strong>
                  contamination with repair
                </span>
                <span>
                  <strong>+8</strong>
                  simulator cost units
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
              <span className="section-kicker">Design implications</span>
              <h2>
                Provenance and revision should become interaction primitives.
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
                  <small>registered in protocol.v1</small>
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
                  <span className="mono-label">ROBUSTNESS SURFACE</span>
                  <h3>
                    The result was tested across intent-label noise and
                    learning rates.
                  </h3>
                  <p>
                    This grid is a parameter sweep, not a confidence surface.
                    Each cell aggregates 240 generated runs.
                  </p>
                </header>
                <div>
                  <SensitivityHeatmap
                    data={sensitivityData(summary.sensitivity)}
                    metric="profileContamination"
                    note="Actor-blind and provenance-aware updating are compared over five label-noise values and four learning rates. The shared scale makes between-facet comparison valid."
                    subtitle="Mean normalized contamination over the registered parameter grid."
                    title="Profile contamination sensitivity"
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
                  <span>$</span> pnpm install{"\n"}
                  <span>$</span> pnpm experiment{"\n"}
                  <span>$</span> pnpm check
                </code>
              </pre>
              <div className="artifact-links">
                <a href={`${base}results/v1/baseline.json`} download>
                  Download full rows <span>6.5 MB ↓</span>
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
                    {reference.year ?? "standard"}
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
            When delegated action becomes identity evidence, provenance and
            revision must become interaction primitives.
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
