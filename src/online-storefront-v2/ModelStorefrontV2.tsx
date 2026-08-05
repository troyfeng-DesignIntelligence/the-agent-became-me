import { useEffect, useMemo, useState } from "react";
import type { OnlineStorefrontV2Summary } from "../data";
import "./model-storefront-v2.css";

type Condition =
  | "no-memory"
  | "logged-inert"
  | "immediate-remove"
  | "held-outcome";
type Mode = "fixed-trace" | "free-running";
type Phase =
  | "task-start"
  | "task-in-progress"
  | "outcome-resolved"
  | "next-task";

interface CaseCondition {
  fixedTraceId: string;
  freeTraceId: string;
  fixedSlates: Record<Phase, string[]>;
  freeSlates: Record<Phase, string[]>;
}
interface ModelCase {
  category: string;
  taskId: string;
  modelSeed: number;
  agentConfig: string;
  outcome: string;
  fixedT1Displacement: number;
  conditions: Record<Condition, CaseCondition>;
}
interface ModelBundle {
  schemaVersion: "online-storefront-v2-model-bundle.v1";
  protocolSha256: string;
  model: {
    name: "SASRec";
    checkpointSeeds: number[];
    inference: string;
  };
  representativeCases: ModelCase[];
}

declare global {
  interface Window {
    __STORE_V2_RESEARCH__?: {
      protocolSha256: string;
      model: string;
      condition: Condition;
      mode: Mode;
      phase: Phase;
      caseIndex: number;
      currentSlate: string[];
      immediateSlate: string[];
      heldSlate: string[];
    };
  }
}

const policies: Record<Condition, { index: string; name: string; note: string }> = {
  "no-memory": { index: "01", name: "No memory", note: "No event survives outside the action itself." },
  "logged-inert": { index: "02", name: "Logged, inert", note: "Audit record only. It is never a model input." },
  "immediate-remove": { index: "03", name: "Immediate, then remove", note: "Pending views enter the SASRec context." },
  "held-outcome": { index: "04", name: "Held until outcome", note: "Task-local retrieval remains; platform context waits." }
};
const phases: Array<{ id: Phase; short: string; label: string }> = [
  { id: "task-start", short: "T0", label: "Task start" },
  { id: "task-in-progress", short: "T1", label: "Task in progress" },
  { id: "outcome-resolved", short: "T2", label: "Outcome resolved" },
  { id: "next-task", short: "T3", label: "Next task" }
];

function ModelShelf({
  label,
  items,
  accent = false
}: {
  label: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <section className={`v2-model-shelf ${accent ? "is-accent" : ""}`}>
      <header><span>{label}</span><b>MODEL TOP 10</b></header>
      <div>
        {items.map((item, index) => (
          <article key={item}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <strong>{item}</strong>
            <small>pseudonymous catalog item</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ModelStorefrontV2() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialMode: Mode = params.get("mode") === "free-running" ? "free-running" : "fixed-trace";
  const requestedPhase = params.get("phase") as Phase | null;
  const [bundle, setBundle] = useState<ModelBundle | null>(null);
  const [summary, setSummary] = useState<OnlineStorefrontV2Summary | null>(null);
  const [caseIndex, setCaseIndex] = useState(0);
  const [condition, setCondition] = useState<Condition>("held-outcome");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>(
    phases.some((row) => row.id === requestedPhase) ? requestedPhase! : "task-in-progress"
  );

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}results/online-storefront-v2/v1/model-bundle.json`).then((response) => {
        if (!response.ok) throw new Error("Could not load the model replay bundle.");
        return response.json() as Promise<ModelBundle>;
      }),
      fetch(`${base}results/online-storefront-v2/v1/summary.json`).then((response) => {
        if (!response.ok) throw new Error("Could not load the v2 summary.");
        return response.json() as Promise<OnlineStorefrontV2Summary>;
      })
    ]).then(([nextBundle, nextSummary]) => {
      setBundle(nextBundle);
      setSummary(nextSummary);
    });
  }, []);

  const activeCase = bundle?.representativeCases[caseIndex] ?? null;
  const slateKey = mode === "fixed-trace" ? "fixedSlates" : "freeSlates";
  const traceKey = mode === "fixed-trace" ? "fixedTraceId" : "freeTraceId";
  const currentSlate = activeCase?.conditions[condition][slateKey][phase] ?? [];
  const immediateSlate = activeCase?.conditions["immediate-remove"][slateKey][phase] ?? [];
  const heldSlate = activeCase?.conditions["held-outcome"][slateKey][phase] ?? [];

  useEffect(() => {
    if (!bundle || !activeCase) return;
    window.__STORE_V2_RESEARCH__ = {
      protocolSha256: bundle.protocolSha256,
      model: bundle.model.name,
      condition,
      mode,
      phase,
      caseIndex,
      currentSlate,
      immediateSlate,
      heldSlate
    };
  }, [activeCase, bundle, caseIndex, condition, currentSlate, heldSlate, immediateSlate, mode, phase]);

  if (!bundle || !summary || !activeCase) {
    return <main className="v2-model-loading">Loading trained-model replay…</main>;
  }

  const activePolicy = policies[condition];
  const activeTrace = activeCase.conditions[condition][traceKey];
  const overlap = immediateSlate.filter((item) => heldSlate.includes(item)).length;
  const liveDisplacement = 1 - overlap / 10;

  return (
    <main className="v2-model-store" data-condition={condition} data-mode={mode} data-phase={phase}>
      <nav className="v2-model-nav">
        <a href={import.meta.env.BASE_URL}>ACI / MODEL STORE V2</a>
        <span>TRAINED SASREC · FROZEN REPLAY · NO PURCHASES</span>
      </nav>

      <header className="v2-model-hero">
        <div>
          <span>CONFIRMATORY EXPERIMENT / {activeCase.category.replaceAll("-", " ")}</span>
          <h1>When may this task count?</h1>
          <p>{bundle.model.inference}</p>
        </div>
        <dl>
          <div><dt>Checkpoint</dt><dd>{phase.replaceAll("-", " ")}</dd></div>
          <div><dt>Model seed</dt><dd>{activeCase.modelSeed}</dd></div>
          <div><dt>Agent</dt><dd>{activeCase.agentConfig.replaceAll("-", " ")}</dd></div>
          <div><dt>Pair displacement</dt><dd>{liveDisplacement.toFixed(3)}</dd></div>
        </dl>
      </header>

      <section className="v2-model-controls" aria-label="Experiment controls">
        <div>
          <span>MODE</span>
          {(["fixed-trace", "free-running"] as Mode[]).map((row) => (
            <button aria-pressed={mode === row} data-mode={row} key={row} onClick={() => setMode(row)} type="button">{row.replaceAll("-", " ")}</button>
          ))}
        </div>
        <div>
          <span>CASE</span>
          {bundle.representativeCases.map((row, index) => (
            <button aria-pressed={caseIndex === index} data-case-index={index} key={`${row.taskId}-${row.agentConfig}`} onClick={() => setCaseIndex(index)} type="button">{String(index + 1).padStart(2, "0")}</button>
          ))}
        </div>
      </section>

      <section className="v2-model-policy-grid" aria-label="Evidence contract">
        {(Object.keys(policies) as Condition[]).map((id) => (
          <button aria-pressed={condition === id} data-condition={id} key={id} onClick={() => setCondition(id)} type="button">
            <i>{policies[id].index}</i>
            <strong>{policies[id].name}</strong>
            <small>{policies[id].note}</small>
          </button>
        ))}
      </section>

      <section className="v2-model-timeline" aria-label="Recommendation checkpoints">
        {phases.map((row) => (
          <button aria-pressed={phase === row.id} data-phase={row.id} key={row.id} onClick={() => setPhase(row.id)} type="button">
            <span>{row.short}</span><strong>{row.label}</strong>
          </button>
        ))}
      </section>

      <section className="v2-model-contract">
        <div><span>ACTIVE CONTRACT / {activePolicy.index}</span><h2>{activePolicy.name}</h2><p>{activePolicy.note}</p></div>
        <dl>
          <div><dt>Trace</dt><dd>{activeTrace}</dd></div>
          <div><dt>Outcome</dt><dd>{activeCase.outcome}</dd></div>
          <div><dt>Protocol</dt><dd>{bundle.protocolSha256.slice(0, 12)}</dd></div>
        </dl>
      </section>

      <div className="v2-model-current">
        <ModelShelf accent label={`${activePolicy.name} / ${phase.replaceAll("-", " ")}`} items={currentSlate} />
      </div>

      <section className="v2-model-comparison" aria-label="Immediate and held comparison">
        <ModelShelf label="IMMEDIATE, THEN REMOVE" items={immediateSlate} />
        <ModelShelf accent label="HELD UNTIL OUTCOME" items={heldSlate} />
      </section>

      <section className="v2-model-ledger">
        <article><span>FIXED T1 / POOLED</span><strong>{summary.confirmatory.fixedTrace.primaryT1ImmediateHeldDisplacement.estimate.toFixed(3)}</strong></article>
        <article><span>FREE TRACE DIVERGENCE</span><strong>{(summary.confirmatory.freeRunning.traceDivergenceRate.estimate * 100).toFixed(1)}%</strong></article>
        <article><span>T2 / T3 FIXED UPPER BOUND</span><strong>0.000</strong></article>
        <article><span>EMPTY MODEL SLATES</span><strong>{summary.failuresAndNegativeCases.emptySlateCount}</strong></article>
      </section>

      <footer className="v2-model-footer">
        <p>Every item ID is pseudonymous. Raw histories, products, titles, and checkpoint tensors are excluded from the public artifact.</p>
        <p>This page replays frozen PyTorch SASRec inference; GitHub Pages does not execute the model or represent a production commerce system.</p>
      </footer>
    </main>
  );
}
