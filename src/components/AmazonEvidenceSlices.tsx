import { useState } from "react";
import type { AmazonFieldSummary } from "../data";

const CONDITIONS = [
  "idle-control",
  "search-only",
  "product-view",
  "cart-stage"
] as const;

const conditionCopy: Record<(typeof CONDITIONS)[number], string> = {
  "idle-control": "Idle control",
  "search-only": "Search only",
  "product-view": "Product views",
  "cart-stage": "Anonymous cart stage"
};

export function AmazonEvidenceSlices({
  summary
}: {
  summary: AmazonFieldSummary;
}) {
  const [condition, setCondition] =
    useState<(typeof CONDITIONS)[number]>("product-view");
  const observation = summary.observations.find(
    (row) => row.condition === condition
  );
  const base = import.meta.env.BASE_URL;
  const positiveTokens = Object.entries(observation?.taskTokenDelta ?? {}).filter(
    ([, value]) => value > 0
  );

  return (
    <section className="amazon-evidence" aria-labelledby="amazon-evidence-title">
      <header>
        <div>
          <span className="mono-label">REDACTED FIELD EVIDENCE / 08 SLICES</span>
          <h3 id="amazon-evidence-title">What the retained browser surface actually showed.</h3>
        </div>
        <p>
          Fixed crops from the signed-out sessions. Product pixels are softened;
          account identity, address, order history, checkout, and payment surfaces
          were never captured. Hashes and crop coordinates are retained in the manifest.
        </p>
      </header>

      <div className="amazon-evidence-tabs" role="tablist" aria-label="Field condition">
        {CONDITIONS.map((id) => (
          <button
            aria-selected={condition === id}
            key={id}
            onClick={() => setCondition(id)}
            role="tab"
            type="button"
          >
            {conditionCopy[id]}
          </button>
        ))}
      </div>

      <div className="amazon-evidence-pair">
        {(["baseline", "post"] as const).map((state) => (
          <figure key={state}>
            <div className="amazon-evidence-image">
              <img
                alt={`${conditionCopy[condition]} ${state} Amazon home-surface crop with product imagery redacted.`}
                loading="lazy"
                src={`${base}evidence/amazon-field/v1/${condition}-${state}-redacted.png`}
              />
              <span>{state === "baseline" ? "BEFORE" : "AFTER"}</span>
            </div>
            <figcaption>
              <b>{state === "baseline" ? "Isolated baseline" : "Post-task sample"}</b>
              <span>same crop window · category-grid surface</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="amazon-evidence-reading">
        <div>
          <span className="mono-label">VISIBLE IN THESE CROPS</span>
          <p>
            A sampled home-surface category grid. The slices preserve page geometry
            and headings but are not presented as proof of a specific recommendation
            mechanism.
          </p>
        </div>
        <div>
          <span className="mono-label">MEASURED FROM FULL-PAGE EXTRACTION</span>
          <p>
            {observation?.moduleDelta.length
              ? `${observation.moduleDelta.length} predefined module change: ${observation.moduleDelta.join(
                  "; "
                )}.`
              : "No predefined module heading appeared in this condition."}
            {positiveTokens.length
              ? ` Positive task-token deltas: ${positiveTokens
                  .map(([token, value]) => `${token} +${value}`)
                  .join(", ")}.`
              : " All task-token deltas were zero."}
          </p>
        </div>
        <div>
          <span className="mono-label">EVIDENCE BOUNDARY</span>
          <p>
            Full-page extraction and retained crops are adjacent evidence, not the
            same observation. A detected heading may fall outside the saved crop.
          </p>
          <a href={`${base}evidence/amazon-field/v1/manifest.json`} download>
            Download provenance manifest ↘
          </a>
        </div>
      </div>
    </section>
  );
}
