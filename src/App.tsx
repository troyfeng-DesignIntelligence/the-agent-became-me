import { useEffect, useMemo, useRef, useState } from "react";
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
import { CrossTaskControlLab } from "./components/CrossTaskControlLab";
import { AmazonEvidenceSlices } from "./components/AmazonEvidenceSlices";
import { PollutionPhaseMap } from "./components/PollutionPhaseMap";
import { ExternalValidationPanel } from "./components/ExternalValidationPanel";
import { LearnedCommercePanel } from "./components/LearnedCommercePanel";
import { CrossCategoryReplicationPanel } from "./components/CrossCategoryReplicationPanel";
import { DelegatedActivationPanel } from "./components/DelegatedActivationPanel";
import { OnlineStorefrontV2Panel } from "./components/OnlineStorefrontV2Panel";
import { LLMBehaviorFeedbackPanel } from "./components/LLMBehaviorFeedbackPanel";
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
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      frame.current = null;
      const range =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(range <= 0 ? 0 : window.scrollY / range);
    };
    const requestUpdate = () => {
      if (frame.current === null) {
        frame.current = window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  return progress;
}

const chapters = [
  { id: "top", label: "Opening", index: "00" },
  { id: "question", label: "Context", index: "01" },
  { id: "evidence", label: "Prototype", index: "02" },
  { id: "outcomes", label: "Outcomes", index: "03" },
  { id: "methods", label: "Source", index: "04" }
] as const;

const archiveChapters = [
  { id: "top", label: "Opening", index: "00" },
  { id: "question", label: "Question", index: "01" },
  { id: "lab", label: "Trace archive", index: "02" },
  { id: "evidence", label: "Evidence", index: "03" },
  { id: "outcomes", label: "Outcomes", index: "04" },
  { id: "methods", label: "Methods", index: "05" }
] as const;

function useActiveChapter(includeArchive: boolean) {
  const [activeChapter, setActiveChapter] = useState("top");

  useEffect(() => {
    const visibleChapters = includeArchive ? archiveChapters : chapters;
    const sections = visibleChapters
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target.id) setActiveChapter(visible.target.id);
      },
      {
        rootMargin: "-22% 0px -58% 0px",
        threshold: [0, 0.1, 0.35, 0.7]
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [includeArchive]);

  return activeChapter;
}

function useEditorialScroll(dataReady: boolean) {
  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const root = document.documentElement;
    const revealGroups = [
      ".question-copy > *, .margin-note, .question-specimen",
      ".project-ownership > *, .project-decision-intro > *, .project-decision",
      ".gap-section .section-header > *, .provocation",
      ".trace-field-copy > *, .trace-field-key > *",
      ".lab-header > *, .interface-lab",
      ".evidence-intro > *, .identity-specimen, .plate",
      ".study-archive, .study-block",
      ".webarena-replay .section-header > *, .webarena-lead, .webarena-stat, .webarena-loop-keys > *, .webarena-contract",
      ".amazon-field .section-header > *, .amazon-field-lead > *, .amazon-condition, .amazon-lifecycle-row, .amazon-claim-boundary > *",
      ".cross-task-section .section-header > *, .cross-task-evidence-heading > *, .cross-task-result, .cross-task-control-lab, .cross-task-prototype-boundary",
      ".portfolio-outcome-summary > *, .portfolio-outcome-grid > *",
      ".learned-commerce",
      ".activation-study",
      ".online-v2-study",
      ".findings-section > .section-header > *, .finding-row",
      ".reliquary-interlude figure > *",
      ".implications-intro > *, .implication-grid article",
      ".methods-section > .section-header > *, .method-ledger > div",
      ".sensitivity-panel, .method-card, .references-block"
    ];
    const targets = revealGroups.flatMap((selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)]
    );

    root.classList.add("scroll-enhanced");
    targets.forEach((target, index) => {
      target.classList.add("scroll-reveal");
      target.style.setProperty(
        "--reveal-delay",
        `${Math.min(index % 4, 3) * 55}ms`
      );
    });

    if (reducedMotion) {
      targets.forEach((target) => target.classList.add("is-revealed"));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -9% 0px", threshold: 0.08 }
    );

    targets.forEach((target) => {
      const bounds = target.getBoundingClientRect();
      if (bounds.top < window.innerHeight * 0.94) {
        target.classList.add("is-revealed");
      } else {
        revealObserver.observe(target);
      }
    });

    const parallaxTargets = [
      { element: document.querySelector<HTMLElement>(".hero-gallery-image"), range: 18 },
      { element: document.querySelector<HTMLElement>(".trace-field-interlude > img"), range: 24 },
      { element: document.querySelector<HTMLElement>(".reliquary-interlude img"), range: 18 }
    ].filter(
      (target): target is { element: HTMLElement; range: number } =>
        target.element !== null
    );
    parallaxTargets.forEach(({ element }) =>
      element.classList.add("scroll-parallax")
    );

    let frame: number | null = null;
    const updateParallax = () => {
      frame = null;
      const viewportCenter = window.innerHeight / 2;
      parallaxTargets.forEach(({ element, range }) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom < -100 || bounds.top > window.innerHeight + 100) return;
        const travel = (bounds.top + bounds.height / 2 - viewportCenter) /
          (window.innerHeight + bounds.height);
        const shift = Math.max(-1, Math.min(1, travel)) * range;
        element.style.setProperty("--scroll-shift", `${shift.toFixed(2)}px`);
      });
    };
    const requestParallax = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax);

    return () => {
      revealObserver.disconnect();
      window.removeEventListener("scroll", requestParallax);
      window.removeEventListener("resize", requestParallax);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [dataReady]);
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
  const base = import.meta.env.BASE_URL;
  return (
    <section className="hero section-shell" id="top">
      <figure className="hero-gallery-art">
        <img
          alt="A nearly empty black exhibition room with a small persistence gate under a spotlight at the far right."
          className="hero-gallery-image"
          decoding="async"
          fetchPriority="high"
          src={`${base}assets/hero-gallery.webp`}
        />
        <div className="hero-gallery-wash" aria-hidden="true" />
        <figcaption>
          SYNTHETIC CONCEPT IMAGE · NOT STUDY DATA
        </figcaption>
      </figure>
      <span className="hero-exhibit" aria-hidden="true">
        EXHIBIT 001 / EVIDENCE ADMISSION
      </span>
      <div className="hero-content">
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
        </div>
        <div className="hero-brief">
          <p className="hero-summary">{hero.summary}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#evidence">
              {hero.primaryAction}
            </a>
            <a className="button button-secondary" href="#ownership">
              {hero.secondaryAction}
            </a>
          </div>
          <div className="synthetic-disclosure">
            <span className="synthetic-dot" aria-hidden="true" />
            <span>
              <strong>Pseudonymous research tasks</strong>
              No human participant data
            </span>
          </div>
        </div>
      </div>
      <div className="hero-ledger" aria-label="Representative trace summary">
        <span>
          <strong>460</strong>
          frozen tasks
        </span>
        <span>
          <strong>920</strong>
          paired units / provider
        </span>
        <span>
          <strong>7,360</strong>
          valid confirmatory calls
        </span>
      </div>
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
          The update rule decides what reaches the profile.
        </h2>
        <p>
          The trace records who acted and why. An actor-blind updater ignores
          both fields and writes the event into the principal's profile.
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

const portfolioDecisions = [
  {
    index: "01",
    title: "Separate recording from activation.",
    before: "One profile indicator implied that a recorded action was already shaping ranking.",
    evidence: "No-state and inert logging produced the same shelves and traces.",
    decision: "Expose task memory, audit state, and ranking eligibility as three different service states."
  },
  {
    index: "02",
    title: "Move the control before exposure.",
    before: "The first control removed temporary evidence only after an abandoned task.",
    evidence: "Removal and holding ended identically, but removal allowed provisional shelf exposure.",
    decision: "Hold task evidence outside ranking until an outcome is resolved."
  },
  {
    index: "03",
    title: "Measure the decision, not trace motion.",
    before: "The pilot treated a changed browsing trace as a changed agent decision.",
    evidence: "A required product view moved the trace without changing selected item or abandon.",
    decision: "Freeze the selectable actions and compare the resolved categorical output."
  }
] as const;

const portfolioOutcomes = [
  {
    value: "0.765",
    label: "in-task shelf displacement",
    evidence: "95% interval [0.745, 0.785] across 460 frozen tasks.",
    consequence: "Ranking eligibility—not event recording—became the control surface."
  },
  {
    value: "0.126 / 0.111",
    label: "resolved-action contrast",
    evidence: "DeepSeek / MiMo; both task-clustered intervals excluded zero.",
    consequence: "The evaluation endpoint moved from trace differences to selected item or abandon."
  },
  {
    value: "≈ 0",
    label: "held-minus-immediate task-quality change",
    evidence: "Frozen offered-candidate surrogate stayed near zero in both providers.",
    consequence: "Task-local help remains on while platform learning waits."
  }
] as const;

function ProjectOwnership() {
  return (
    <section className="project-ownership section-shell" id="ownership" aria-labelledby="ownership-title">
      <div className="project-ownership__intro">
        <span className="mono-label">PROJECT OWNERSHIP</span>
        <h2 id="ownership-title">An independent interaction-design research project.</h2>
      </div>
      <dl className="project-ownership__grid">
        <div><dt>ROLE</dt><dd>Interaction designer + researcher</dd></div>
        <div><dt>TEAM</dt><dd>Solo-directed · AI-assisted execution</dd></div>
        <div><dt>OWNED</dt><dd>Framing · protocol · service logic · interface · frontend</dd></div>
        <div><dt>OUTPUT</dt><dd>HAI poster submission · executable prototype · reproducible artifact</dd></div>
      </dl>
      <p className="project-ownership__boundary">
        Project direction, claims, design decisions, and final review remain the
        applicant’s responsibility. AI assisted coding, analysis, visual exploration,
        and QA. Identity is withheld here while the associated submission is under
        blind review.
      </p>
    </section>
  );
}

function ProjectDecisions() {
  return (
    <section className="project-decisions section-shell" aria-labelledby="decisions-title">
      <header className="project-decision-intro">
        <span className="section-kicker">Three decisions I made</span>
        <h2 id="decisions-title">The project changed when the evidence contradicted the interface.</h2>
      </header>
      <div className="project-decision-grid">
        {portfolioDecisions.map((item) => (
          <article className="project-decision" key={item.index}>
            <span>{item.index}</span>
            <h3>{item.title}</h3>
            <dl>
              <div><dt>EARLIER VERSION</dt><dd>{item.before}</dd></div>
              <div><dt>WHAT CHANGED IT</dt><dd>{item.evidence}</dd></div>
              <div><dt>DESIGN DECISION</dt><dd>{item.decision}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function PortfolioOutcomeSummary() {
  return (
    <section className="portfolio-outcome-summary" id="outcomes" aria-labelledby="portfolio-outcome-title">
      <header>
        <span className="mono-label">THREE RESULTS / DEFAULT READING PATH</span>
        <h3 id="portfolio-outcome-title">Enough evidence to change the design.</h3>
        <p>Three estimates carry the portfolio argument. The complete experiment history remains available separately.</p>
      </header>
      <div className="portfolio-outcome-grid">
        {portfolioOutcomes.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <h4>{item.label}</h4>
            <p>{item.evidence}</p>
            <small><b>DESIGN CONSEQUENCE</b>{item.consequence}</small>
          </article>
        ))}
      </div>
      <a className="portfolio-research-link" href="?research=1#evidence">
        Open complete Research Appendix <span>↗</span>
      </a>
    </section>
  );
}

export function App() {
  const scrollProgress = useScrollProgress();
  const searchParams = new URLSearchParams(window.location.search);
  const showArchive = searchParams.get("archive") === "1";
  const showResearch = showArchive || searchParams.get("research") === "1";
  const visibleChapters = showArchive ? archiveChapters : chapters;
  const {
    summary,
    webarena,
    webarenaFailure,
    amazonField,
    amazonControlled,
    crossTaskExposure,
    crossTaskSensitivity,
    externalValidity,
    amazonSasrec,
    amazonCrossCategory,
    delegatedActivation,
    onlineStorefrontV2,
    mimoLlmPilot,
    mimoMatchedLlmPilot,
    deepseekLlmPilot,
    decodingDoseResponse,
    forcedInspection,
    candidateMargin,
    deterministicRepairPilot,
    naturalActionEvaluation,
    instrumentAblationEvaluation,
    feedbackBridgeSummary,
    feedbackActionEvaluation,
    mimoFeedbackActionEvaluation,
    naturalLanguagePolicyEvaluation,
    catalog,
    error,
    loading
  } = useProjectData();
  const activeChapter = useActiveChapter(showArchive);
  useEditorialScroll(Boolean(summary));

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
          <a
            aria-current={activeChapter === "question" ? "location" : undefined}
            className={activeChapter === "question" ? "is-active" : ""}
            href="#question"
          >
            Context
          </a>
          {showArchive && (
            <a
              aria-current={activeChapter === "lab" ? "location" : undefined}
              className={activeChapter === "lab" ? "is-active" : ""}
              href="#lab"
            >
              Trace archive
            </a>
          )}
          <a
            aria-current={activeChapter === "evidence" ? "location" : undefined}
            className={activeChapter === "evidence" ? "is-active" : ""}
            href="#evidence"
          >
            Prototype
          </a>
          <a
            aria-current={activeChapter === "outcomes" ? "location" : undefined}
            className={activeChapter === "outcomes" ? "is-active" : ""}
            href="#outcomes"
          >
            Outcomes
          </a>
          <a
            aria-current={activeChapter === "methods" ? "location" : undefined}
            className={activeChapter === "methods" ? "is-active" : ""}
            href="#methods"
          >
            Source
          </a>
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

      <div className="chapter-rail" aria-hidden="true">
        <span>
          {visibleChapters.find((chapter) => chapter.id === activeChapter)?.index ?? "00"}
        </span>
        <div>
          {visibleChapters.map((chapter) => (
            <i
              className={chapter.id === activeChapter ? "is-active" : ""}
              key={chapter.id}
            />
          ))}
        </div>
        <small>
          {visibleChapters.find((chapter) => chapter.id === activeChapter)?.label ?? "Opening"}
        </small>
      </div>

      <main id="main">
        <Hero />

        <ProjectOwnership />

        <section className="question-section section-shell" id="question">
          <div className="section-number">01</div>
          <div className="question-copy">
            <span className="section-kicker">{researchQuestion.label}</span>
            <h2>{researchQuestion.headline}</h2>
            <p className="question-statement">{researchQuestion.question}</p>
            <div className="question-notes">
              <div>
                <span className="mono-label">Scope</span>
                <p>{researchQuestion.framing}</p>
              </div>
              <div>
                <span className="mono-label">What I built</span>
                <p>{researchQuestion.contribution}</p>
              </div>
            </div>
          </div>
          <aside className="margin-note">
            <span className="mono-label">CLAIM BOUNDARY</span>
            <p>{researchQuestion.noveltyBoundary}</p>
          </aside>
          <figure className="question-specimen">
            <img
              alt="Loose cobalt threads pass beneath a removable vellum instruction slip on a conservation table."
              loading="lazy"
              src={`${base}assets/temporary-intent.webp`}
            />
            <figcaption>
              <span>SPECIMEN A / TEMPORARY INTENT</span>
              <p>A temporary task can stay local until its outcome is known.</p>
            </figcaption>
          </figure>
        </section>

        <section className="gap-section section-shell">
          <header className="section-header">
            <div>
              <span className="section-kicker">The timing problem</span>
              <h2>The recommender can react before the task is over.</h2>
            </div>
            <p>
              Recording an event, using it inside the task, and activating it for
              platform personalization are three different decisions.
            </p>
          </header>
          <CausalRibbon />
          <div className="provocation">
            <span aria-hidden="true">“</span>
            <p>
              When should a temporary task become evidence for platform
              personalization?
            </p>
          </div>
        </section>

        <ProjectDecisions />

        {showArchive && <TraceFieldInterlude />}

        {showArchive && (
        <section className="lab-section section-shell" id="lab">
          <div className="section-number">02</div>
          <header className="section-header lab-header">
            <div>
              <span className="section-kicker">One trace, six contracts</span>
              <h2>Hold the trace fixed. Change the update rule.</h2>
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
        )}

        {showArchive && summary && evidence && (
          <section className="evidence-section" id="evidence">
            <div className="section-shell">
              <div className="section-number light">03</div>
              <div className="evidence-opening">
                <header className="evidence-intro">
                  <span className="section-kicker">Generated evidence</span>
                  <h2>
                    Selective provenance did not beat a matched shrinkage
                    control.
                  </h2>
                  <p>
                    The matched control changed my conclusion. These results
                    come from a synthetic protocol. They do not measure people,
                    live platforms, or experienced consent.
                  </p>
                </header>
                <figure className="identity-specimen">
                  <img
                    alt="A heavy black registration plate presses red and blue thread traces into handmade archival paper."
                    loading="lazy"
                    src={`${base}assets/identity-imprint.webp`}
                  />
                  <figcaption>
                    <span>SPECIMEN C / IDENTITY IMPRINT</span>
                    Conceptual image · not an observed trace
                  </figcaption>
                </figure>
              </div>
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
                note="This schematic tracks how a temporary request can produce a persistent profile update."
                title="The delegation gap"
              >
                <CausalRibbon activeStage={3} />
              </Plate>

              <Plate
                index="02"
                label="CONDITION DISTRIBUTIONS"
                meta={`GENERATED · 4 SCENARIOS · 480 RUNS/CONDITION · ${summary.protocolVersion.toUpperCase()}`}
                note="Each card pools four synthetic scenarios, three policies, and 40 paired seeds. Whiskers are descriptive P10 to P90 ranges."
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
                note="Each path links one actor-blind event to its largest signed trait change. The table below contains the exact receipt values."
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
                note="Each row keeps one definition across contracts: recording error, label error, provenance use, or persistence rate."
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
                note="Study A freezes every trace. Study B changes the ranking signal and the persistence rule, so I report it separately."
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
                    note="The impact-proxy conditions share the same behavior traces. Their difference isolates the hold-before-activation rule; cost is a modeled index, not measured burden."
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
                note="This stress test starts from a disclosed but stale profile. It checks one case where preserving state gives the wrong result."
                title="No update is not a universal integrity strategy"
                variant="paper"
              >
                <ConditionOutcomePanel
                  note="This is one deliberately aligned task, not evidence of external validity. It tests the rule that less learning is always better."
                  rows={summary.overallC}
                  studyLabel="STUDY C · STALE INITIAL PROFILE"
                  title="Learning-needed stress test"
                />
              </Plate>
            </div>
          </section>
        )}

        {showArchive && summary && evidence && (
          <section className="studies-section section-shell">
            <figure className="study-archive">
              <img
                alt="Open black archive drawers keep bundles of blue evidence threads separated from a closed red record drawer."
                loading="lazy"
                src={`${base}assets/quarantine-archive.webp`}
              />
              <figcaption>
                <span className="mono-label">SPECIMEN D / STAGED HOLD</span>
                <h2>Logging does not have to mean learning.</h2>
                <p>
                  The system can retain an event for inspection without using
                  it to update the principal's profile.
                </p>
                <small>SYNTHETIC CONCEPT IMAGE · NOT STUDY DATA</small>
              </figcaption>
            </figure>
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
                  divergence with staged hold
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

        {showArchive && webarena && webarenaFailure && (
          <section className="webarena-replay section-shell">
            <header className="section-header">
              <div>
                <span className="section-kicker">Released trajectory experiment</span>
                <h2>Failure did not erase the profile evidence.</h2>
              </div>
              <p>
                All 192 released GPT-4 CoT shopping traces were replayed through
                six evidence-lifecycle contracts. OCR and a bounded screenshot
                audit checked the action mapper before policy comparison.
              </p>
            </header>

            <div className="webarena-ledger">
              <article className="webarena-lead">
                <span className="mono-label">OBSERVED / RELEASED TRACES</span>
                <strong>
                  {
                    webarena.outcomeStrata.find(
                      (row) => row.outcome === "Failure"
                    )?.totalMappedEvidenceEvents
                  }
                  <small> / {webarena.corpus.mappedEvidenceEventCount}</small>
                </strong>
                <h3>mapped evidence events occurred in failed trajectories.</h3>
                <p>
                  A task can fail while its product views, review openings,
                  shortlist actions, and purchases still look like preference
                  evidence to a separate profile updater. This is exposure, not
                  measured user harm.
                </p>
              </article>

              <div className="webarena-stats" aria-label="Released trace coverage">
                {[
                  [webarenaFailure.corpus.traceCount, "shopping traces"],
                  [webarenaFailure.corpus.auditedStepCount, "audited steps"],
                  [
                    percent(
                      webarenaFailure.mapperValidation.ocrCorroborationRate,
                      1
                    ),
                    "OCR corroborated"
                  ],
                  [
                    `${webarenaFailure.screenshotValidation.validEvidenceTargetCount}/${webarenaFailure.screenshotValidation.recordCount}`,
                    "screenshots validated"
                  ]
                ].map(([value, label]) => (
                  <div className="webarena-stat" key={label}>
                    <strong>
                      {typeof value === "number"
                        ? value.toLocaleString()
                        : value}
                    </strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="webarena-loop-keys">
              <article>
                <span className="mono-label">NODE + LABEL / PRIMARY</span>
                <strong>
                  {percent(
                    webarenaFailure.loopAnalysis.conservativeExactTarget
                      .repeatedShare,
                    1
                  )}
                </strong>
                <p>
                  repeated actions when both the accessibility node and target
                  label must match.
                </p>
              </article>
              <article>
                <span className="mono-label">LABEL ONLY / SENSITIVITY</span>
                <strong>
                  {percent(
                    webarenaFailure.loopAnalysis.labelOnlySensitivity
                      .repeatedShare,
                    1
                  )}
                </strong>
                <p>
                  repeated actions if identically named controls are treated as
                  the same target across a page.
                </p>
              </article>
              <p>
                The 25× gap is the finding: “repeated action” is not a stable
                measurement until target identity is defined. Label-only
                deduplication removes {percent(
                  webarenaFailure.observedComparisons
                    .labelOnlyDedupFailedResidualReduction,
                  1
                )} of failed residual mass, but also discards {percent(
                  1 -
                    webarenaFailure.observedComparisons
                      .labelOnlyDedupSuccessfulEvidenceRetention,
                  1
                )} of successful evidence.
              </p>
            </div>

            <div className="webarena-contracts">
              <div className="webarena-contract-legend">
                <span>FAILED-TRACE RESIDUAL MASS</span>
                <span>LOWER IS BETTER</span>
              </div>
              {webarenaFailure.conditions.map((row) => (
                <div className="webarena-contract" key={row.condition}>
                  <span>{row.condition.replaceAll("-", " ")}</span>
                  <i>
                    <b
                      style={{
                        transform: `scaleX(${
                          row.totalFailedResidualMass / 26.86
                        })`
                      }}
                    />
                  </i>
                  <output>{row.totalFailedResidualMass.toFixed(2)}</output>
                </div>
              ))}
            </div>

            <p className="webarena-boundary">
              Holding before activation and rollback both remove 100% of final failed-task
              residual mass in this replay. They are not equivalent: rollback
              first exposes a mean provisional mass of{" "}
              {webarenaFailure.observedComparisons.rollbackProvisionalMass.toFixed(3)}
              , then removes {webarenaFailure.observedComparisons.rollbackRemovedMass.toFixed(2)}
              . Holding writes nothing provisionally. Deduplication barely
              changes the result because exact repeated targets were rare.
            </p>
          </section>
        )}

        {showArchive && amazonField && amazonControlled && (
          <section className="amazon-field section-shell" aria-labelledby="amazon-field-title">
            <header className="section-header">
              <div>
                <span className="section-kicker">Live storefront / bounded probe</span>
                <h2 id="amazon-field-title">The trail appeared on a live storefront.</h2>
              </div>
              <p>
                Four isolated, signed-out contexts tested one temporary phone-shopping
                task. This is a page-level observation, not access to Amazon's profile
                system and not proof of long-term personalization.
              </p>
            </header>

            <div className="amazon-field-lead">
              <div className="amazon-field-signal">
                <span className="mono-label">LARGEST OBSERVED PAGE SHIFT</span>
                <strong>02</strong>
                <h3>history-related modules appeared after product views.</h3>
              </div>
              <div className="amazon-field-protocol" aria-label="Field probe protocol">
                <div>
                  <span>CONTEXTS</span>
                  <strong>{amazonField.execution.completedConditionCount}</strong>
                  <small>isolated and signed out</small>
                </div>
                <div>
                  <span>CUMULATIVE NAVIGATIONS</span>
                  <strong>{amazonField.execution.researchCumulativeNavigations}</strong>
                  <small>frozen budget exhausted</small>
                </div>
                <div>
                  <span>ACCOUNT ACTIONS</span>
                  <strong>0</strong>
                  <small>no login, checkout, or purchase</small>
                </div>
                <div>
                  <span>CART AFTER CLEANUP</span>
                  <strong>
                    {amazonField.observations.find(
                      (row) => row.condition === "cart-stage"
                    )?.cleanup.cartCountAfter ?? "-"}
                  </strong>
                  <small>anonymous item removed</small>
                </div>
              </div>
            </div>

            <div className="amazon-condition-grid" aria-label="Observed field conditions">
              {amazonField.observations.map((row) => {
                const positiveTokens = Object.entries(row.taskTokenDelta).filter(
                  ([, value]) => value > 0
                );
                return (
                  <article
                    className={`amazon-condition ${
                      row.condition === "product-view" ? "is-signal" : ""
                    }`}
                    key={row.condition}
                  >
                    <header>
                      <span>{row.condition.replaceAll("-", " ")}</span>
                      <strong>{row.asinJaccard.toFixed(3)}</strong>
                      <small>baseline/post ASIN Jaccard</small>
                    </header>
                    <div>
                      <p className="amazon-condition-count">
                        <b>{row.moduleDelta.length}</b> new known module
                        {row.moduleDelta.length === 1 ? "" : "s"}
                      </p>
                      {row.moduleDelta.length > 0 ? (
                        <ul>
                          {row.moduleDelta.map((module) => (
                            <li key={module}>{module}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="amazon-condition-empty">No predefined module appeared.</p>
                      )}
                    </div>
                    <footer>
                      {positiveTokens.length > 0
                        ? positiveTokens
                            .map(([token, value]) => `${token} +${value}`)
                            .join(" / ")
                        : "task-token deltas: all zero"}
                    </footer>
                  </article>
                );
              })}
            </div>

            <AmazonEvidenceSlices summary={amazonField} />

            <div className="amazon-controlled">
              <header>
                <span className="mono-label">CONTROLLED LIFECYCLE REPLAY</span>
                <h3>Same actions. Six rules for what is allowed to remain.</h3>
                <p>
                  The local replay isolates provisional exposure from final persistence.
                  All task-bearing traces end as abandoned; values are executable evidence
                  mass, not Amazon scores.
                </p>
              </header>
              <div className="amazon-lifecycle">
                <div className="amazon-lifecycle-legend">
                  <span>FAILED-TASK RESIDUAL</span>
                  <span>PROVISIONAL EXPOSURE</span>
                </div>
                {amazonControlled.conditions.map((row) => (
                  <div className="amazon-lifecycle-row" key={row.condition}>
                    <span>{row.condition.replaceAll("-", " ")}</span>
                    <i aria-hidden="true">
                      <b
                        style={{
                          transform: `scaleX(${row.totalFailedResidualMass / 1.33})`
                        }}
                      />
                    </i>
                    <output>{row.totalFailedResidualMass.toFixed(4)}</output>
                    <em>{row.totalProvisionalProfileMass.toFixed(4)}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="amazon-claim-boundary">
              <div>
                <span className="mono-label">OBSERVED</span>
                <p>
                  Product-view sessions introduced explicit browsing-history and
                  related-items headings plus positive task-token deltas. Idle and
                  search-only sessions did not in this run.
                </p>
              </div>
              <div>
                <span className="mono-label">NOT ESTABLISHED</span>
                <p>
                  An internal profile update, an account-level effect, or a monotonic
                  order in which stronger actions produce stronger personalization.
                </p>
              </div>
            </div>
          </section>
        )}

        {crossTaskExposure && (
          <section
            aria-labelledby="cross-task-title"
            className="cross-task-section section-shell"
            id={showArchive ? "main-evidence" : "evidence"}
          >
            <header className="section-header">
              <div>
                <span className="section-kicker">Main evidence</span>
                <h2 id="cross-task-title">
                  When does a changed shelf become a different decision?
                </h2>
              </div>
              <p>
                Start with the service boundary, then test its consequence at
                three levels: learned rankings, agent trajectories, and resolved
                LLM actions.
              </p>
            </header>

            <div className="cross-task-instrument-heading">
              <span className="mono-label">INTERACTIVE SERVICE BLUEPRINT</span>
              <h3>Deletion and prevention can end alike while taking different paths.</h3>
              <p>
                Scrub one shared agent trace across the outcome gate. The two
                service policies differ only in when an action becomes eligible
                for platform ranking.
              </p>
            </div>
            <CrossTaskControlLab summary={crossTaskExposure} />

            {showResearch ? (
            <div className="cross-task-evidence-heading" id="research-evidence-stack">
              <span className="mono-label">EMPIRICAL CHECK / THREE LAYERS</span>
              <h3>Does that eligibility boundary change what the agent later sees and does?</h3>
              <p>
                The sections below move from recommender displacement to free-running
                trajectories and finally to resolved model actions.
              </p>
            </div>
            ) : (
              <PortfolioOutcomeSummary />
            )}

            {showArchive && (
            <div className="cross-task-results">
              {[
                [
                  crossTaskExposure.conditions.find(
                    (row) => row.condition === "persist-all"
                  )?.meanPostTaskExposureCount.toFixed(2) ?? "-",
                  "later recommendation slots",
                  "when every temporary action persists"
                ],
                [
                  crossTaskExposure.conditions.find(
                    (row) => row.condition === "intent-weighted"
                  )?.meanPostTaskExposureCount.toFixed(3) ?? "-",
                  "later recommendation slots",
                  "after intent weighting"
                ],
                [
                  crossTaskExposure.observedComparisons
                    .rollbackVsQuarantineProvisionalExposureDifference.toFixed(2),
                  "extra provisional slots",
                  "rollback exposed before removal"
                ],
                [
                  `${(
                    crossTaskExposure.observedComparisons
                      .currentTaskShareGainQuarantineVsPersist * 100
                  ).toFixed(1)}%`,
                  "current-task share gained",
                  "hold-before-activation versus persist-all"
                ]
              ].map(([value, label, note], index) => (
                <article className="cross-task-result" key={label + note}>
                  <span>0{index + 1}</span>
                  <strong>{value}</strong>
                  <h3>{label}</h3>
                  <p>{note}</p>
                </article>
              ))}
            </div>
            )}

            {showArchive && externalValidity && (
              <ExternalValidationPanel summary={externalValidity} />
            )}

            {showArchive && amazonSasrec && (
              <LearnedCommercePanel summary={amazonSasrec} />
            )}

            {showResearch && amazonCrossCategory && (
              <CrossCategoryReplicationPanel summary={amazonCrossCategory} />
            )}

            {showArchive && delegatedActivation && (
              <DelegatedActivationPanel summary={delegatedActivation} />
            )}

            {showResearch && onlineStorefrontV2 && (
              <OnlineStorefrontV2Panel summary={onlineStorefrontV2} />
            )}

            {showResearch &&
              forcedInspection &&
              candidateMargin &&
              deterministicRepairPilot &&
              naturalActionEvaluation &&
              instrumentAblationEvaluation &&
              feedbackBridgeSummary &&
              feedbackActionEvaluation &&
              mimoFeedbackActionEvaluation &&
              naturalLanguagePolicyEvaluation && (
              <LLMBehaviorFeedbackPanel
                forced={forcedInspection}
                repair={deterministicRepairPilot}
                historicalMargin={candidateMargin}
                natural={naturalActionEvaluation}
                ablation={instrumentAblationEvaluation}
                feedbackBridge={feedbackBridgeSummary}
                feedbackAction={feedbackActionEvaluation}
                mimoFeedbackAction={mimoFeedbackActionEvaluation}
                naturalLanguagePolicy={naturalLanguagePolicyEvaluation}
              />
            )}

            {showArchive && crossTaskSensitivity && (
              <PollutionPhaseMap summary={crossTaskSensitivity} />
            )}
          </section>
        )}

        {showResearch && (
        <section className="findings-section section-shell" id="outcomes">
          <div className="section-number">04</div>
          <header className="section-header">
            <div>
              <span className="section-kicker">Evidence status</span>
              <h2>Two results, one audit, and one current-task guardrail.</h2>
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
        )}

        <section className="reliquary-interlude">
          <figure className="section-shell">
            <img
              alt="A black specimen frame holds paper evidence and blue and red threads that converge into a dark imprint."
              loading="lazy"
              src={`${base}assets/evidence-reliquary.webp`}
            />
            <figcaption>
              <span className="mono-label">SPECIMEN B / MISFILED</span>
              <h2>A detailed trace can still hide when evidence became active.</h2>
              <p>Task-local use and platform activation need separate states in the interface.</p>
              <small>CONCEPTUAL IMAGE · NOT STUDY DATA</small>
            </figcaption>
          </figure>
        </section>

        <section className="implications-section">
          <div className="section-shell">
            <div className="section-number light">05</div>
            <header className="implications-intro">
              <span className="section-kicker">Testable design hypotheses</span>
              <h2>Design controls around activation time.</h2>
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
              <h2>{showResearch ? "Every chart can be traced to generated rows." : "The evidence remains inspectable."}</h2>
            </div>
            <p>
              This site is the reading layer. The repository contains the
              protocol, source snapshot, deterministic runner, tests, and full
              output.
            </p>
          </header>

          {showArchive && summary && (
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
                    note="Actor-blind and provenance-aware updating are compared over five label-noise values and four learning rates. P10 to P90 values are available below; lower means can arise for the wrong mechanistic reason."
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
              <h3>Rebuild the main experiment outputs.</h3>
              <pre>
                <code>
                  <span>$</span> pnpm install --frozen-lockfile{"\n"}
                  <span>$</span> pnpm online:v2:evaluate{"\n"}
                  <span>$</span> pnpm online:repair-pilot:evaluate{"\n"}
                  <span>$</span> pnpm build
                </code>
              </pre>
              <div className="artifact-links">
                <a href={`${base}results/online-storefront-v2/v1/summary.json`} download>
                  Storefront summary <span>JSON ↓</span>
                </a>
                <a href={`${base}results/online-storefront-deterministic-repair-pilot/v1/evaluation/summary.json`} download>
                  LLM pilot summary <span>JSON ↓</span>
                </a>
                <a href="?view=service-design">
                  Open service-design appendix <span>↗</span>
                </a>
                {showResearch ? (
                  <a href="./#evidence">
                    Return to portfolio case <span>↗</span>
                  </a>
                ) : (
                  <a href="?research=1#evidence">
                    Open Research Appendix <span>↗</span>
                  </a>
                )}
                <a href="?archive=1#lab">
                  Open development archive <span>↗</span>
                </a>
              </div>
            </article>

            <article className="method-card">
              <span className="mono-label">LIMITATIONS</span>
              <h3>What this project cannot tell us.</h3>
              <ol className="limitations-list">
                {(showResearch ? limitations : limitations.slice(0, 4)).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </article>
          </div>

          {showResearch && (
          <div className="references-block">
            <header>
              <span className="mono-label">COLLISION & REUSE MAP</span>
              <h3>This project starts from existing work.</h3>
              <p>
                I use prior work on simulators, provenance standards,
                recommendation agents, and editable profiles to set the scope
                of the contribution.
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
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <span className="footer-mark">ACI / 01</span>
          <h2>
            Temporary task help does not need immediate platform activation.
          </h2>
        </div>
        <div className="footer-meta">
          <span>Independent portfolio research artifact</span>
          <span>Public review histories · No human participants</span>
          <span>MIT code · Open Food Facts ODbL metadata</span>
        </div>
        <a href="#top">Back to top ↑</a>
      </footer>
    </>
  );
}
