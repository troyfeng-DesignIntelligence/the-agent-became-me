import { useEffect, useMemo, useState } from "react";
import { AXES, type Catalog, type StudyACondition } from "../domain/schema";
import type { RepresentativeReplay } from "../data";
import { formatAxis } from "./EditorialVisuals";

type LabCondition = Extract<
  StudyACondition,
  "actor-blind" | "provenance-aware" | "approval-gated"
>;

const conditionMeta: Record<
  LabCondition,
  {
    short: string;
    label: string;
    premise: string;
    tone: "error" | "provenance" | "negotiated";
  }
> = {
  "actor-blind": {
    short: "U",
    label: "Unmarked",
    premise: "Every action is treated as evidence about the principal.",
    tone: "error"
  },
  "provenance-aware": {
    short: "P",
    label: "Provenance-aware",
    premise: "Actor and inferred intent change the update weight.",
    tone: "provenance"
  },
  "approval-gated": {
    short: "N",
    label: "Approval-gated",
    premise: "Only in-scope, explicitly confirmed evidence can persist.",
    tone: "negotiated"
  }
};

interface InterfaceLabProps {
  replay: RepresentativeReplay;
  catalog: Catalog;
}

export function InterfaceLab({ replay, catalog }: InterfaceLabProps) {
  const [condition, setCondition] = useState<LabCondition>("actor-blind");
  const [step, setStep] = useState(7);
  const [playing, setPlaying] = useState(false);
  const maxStep = replay.trace.events.length - 1;
  const world = replay.worlds[condition];
  const event = replay.trace.events[step];
  const receipt = world.receipts[step];
  const history = world.profileHistory.find((point) => point.step === step);
  const profile = history?.profile ?? replay.scenario.principalReference;
  const productsById = useMemo(
    () => new Map(catalog.products.map((product) => [product.id, product])),
    [catalog.products]
  );
  const product = productsById.get(event.productId);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= maxStep) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [maxStep, playing]);

  const replayFromStart = () => {
    setStep(0);
    setPlaying(true);
  };

  const maxDeltaAxis = AXES.reduce((winner, axis) =>
    Math.abs(receipt.delta[axis]) > Math.abs(receipt.delta[winner])
      ? axis
      : winner
  );

  return (
    <div className="interface-lab">
      <div className="lab-toolbar">
        <div
          className="condition-tabs"
          role="tablist"
          aria-label="Profile update interface condition"
        >
          {(Object.keys(conditionMeta) as LabCondition[]).map((id) => {
            const meta = conditionMeta[id];
            return (
              <button
                aria-selected={condition === id}
                className={`condition-tab tone-${meta.tone}`}
                key={id}
                onClick={() => setCondition(id)}
                role="tab"
                type="button"
              >
                <span>{meta.short}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
        <span className="comparison-lock">
          <span aria-hidden="true">⌁</span> Same scenario · policy · seed
        </span>
      </div>

      <div className="lab-context">
        <div>
          <span className="mono-label">SYNTHETIC BRIEF</span>
          <p>“{replay.scenario.brief}”</p>
        </div>
        <div>
          <span className="mono-label">CURRENT RULE</span>
          <p>{conditionMeta[condition].premise}</p>
        </div>
      </div>

      <div className="lab-stage">
        <article className="trace-receipt">
          <header>
            <span className="mono-label">EVENT RECEIPT</span>
            <span className="receipt-id">
              {String(step + 1).padStart(2, "0")} /{" "}
              {String(maxStep + 1).padStart(2, "0")}
            </span>
          </header>
          <div className="receipt-action">
            <span className="action-mark">{event.action.slice(0, 1)}</span>
            <div>
              <strong>{event.action}</strong>
              <span>{product?.name ?? event.productId}</span>
            </div>
          </div>
          <dl className="receipt-ledger">
            <div>
              <dt>Actual actor</dt>
              <dd className="agent-copy">{event.actor}</dd>
            </div>
            <div>
              <dt>Recorded actor</dt>
              <dd
                className={
                  receipt.recordedActor === "principal"
                    ? "error-copy"
                    : "provenance-copy"
                }
              >
                {receipt.recordedActor}
              </dd>
            </div>
            <div>
              <dt>Actual intent</dt>
              <dd>{event.actualIntent}</dd>
            </div>
            <div>
              <dt>Observed intent</dt>
              <dd>{event.observedIntent}</dd>
            </div>
          </dl>
          <div className="reason-codes">
            {event.reasonCodes.map((reason) => (
              <span key={reason}>{reason.replaceAll("_", " ")}</span>
            ))}
          </div>
        </article>

        <article className="profile-inspector">
          <header>
            <span className="mono-label">PROFILE AT STEP {step + 1}</span>
            <span className={`status-pill tone-${conditionMeta[condition].tone}`}>
              {receipt.status}
            </span>
          </header>
          <div className="profile-bars">
            {AXES.map((axis) => {
              const reference = replay.scenario.principalReference[axis];
              const value = profile[axis];
              return (
                <div className="profile-bar-row" key={axis}>
                  <span>{formatAxis(axis)}</span>
                  <div className="profile-bar-track">
                    <span
                      className="profile-reference"
                      style={{ left: `${reference * 100}%` }}
                    />
                    <span
                      className={`profile-value tone-${conditionMeta[condition].tone}`}
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                  <output>{value.toFixed(2)}</output>
                </div>
              );
            })}
          </div>
          <div className="reference-key">
            <span>
              <i /> latent reference
            </span>
            <span>current inferred profile</span>
          </div>
        </article>

        <article className="impact-panel">
          <header>
            <span className="mono-label">UPDATE IMPACT</span>
            <span className="receipt-id">
              weight {receipt.effectiveWeight.toFixed(3)}
            </span>
          </header>
          <div className="impact-big">
            <span>{formatAxis(maxDeltaAxis)}</span>
            <strong
              className={
                receipt.delta[maxDeltaAxis] === 0
                  ? ""
                  : receipt.delta[maxDeltaAxis] > 0
                    ? "positive-delta"
                    : "negative-delta"
              }
            >
              {receipt.delta[maxDeltaAxis] > 0 ? "+" : ""}
              {(receipt.delta[maxDeltaAxis] * 100).toFixed(1)}
              <small> pp</small>
            </strong>
          </div>
          <div className="impact-rule">
            <span>Provenance used</span>
            <strong>{receipt.updaterUsedProvenance ? "yes" : "no"}</strong>
          </div>
          <p className="impact-note">
            {receipt.recordedActor === "principal"
              ? "The delegate’s action is being written into the principal’s record."
              : receipt.status === "excluded"
                ? "The trace remains auditable, but this update does not persist."
                : "Actor and intent remain attached to the evidence."}
          </p>
        </article>
      </div>

      <div className="trace-controls">
        <button
          aria-label={playing ? "Pause trace" : "Play trace"}
          className="round-control"
          onClick={() => setPlaying((current) => !current)}
          type="button"
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <input
          aria-label="Trace step"
          max={maxStep}
          min={0}
          onChange={(event) => {
            setPlaying(false);
            setStep(Number(event.target.value));
          }}
          style={
            {
              "--trace-progress": `${(step / Math.max(1, maxStep)) * 100}%`
            } as React.CSSProperties
          }
          type="range"
          value={step}
        />
        <button className="text-control" onClick={replayFromStart} type="button">
          Replay
        </button>
      </div>

      <div className="world-comparison" aria-label="Final profile comparison">
        {(Object.keys(conditionMeta) as LabCondition[]).map((id) => {
          const item = replay.worlds[id];
          const selected = condition === id;
          return (
            <button
              className={`world-card${selected ? " is-selected" : ""}`}
              key={id}
              onClick={() => setCondition(id)}
              type="button"
            >
              <span className={`world-letter tone-${conditionMeta[id].tone}`}>
                {conditionMeta[id].short}
              </span>
              <span>
                <strong>{conditionMeta[id].label}</strong>
                <small>final contamination</small>
              </span>
              <output>{item.metrics.profileContamination.toFixed(3)}</output>
            </button>
          );
        })}
      </div>
    </div>
  );
}
