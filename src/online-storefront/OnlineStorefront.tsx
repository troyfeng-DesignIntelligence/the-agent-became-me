import { useEffect, useMemo, useState } from "react";
import { CatalogSchema, type Catalog, type Product } from "../domain/schema";
import {
  rankProducts,
  searchProducts,
  STOREFRONT_TASKS,
  taskLocalProfile,
  type ActivationArm
} from "./model";
import {
  beginNextTask,
  createStorefrontState,
  resolveTask,
  viewProduct
} from "./state";
import "./storefront.css";

declare global {
  interface Window {
    __STORE_RESEARCH__?: {
      phase: string;
      arm: ActivationArm;
      taskId: string;
      viewedIds: string[];
      stagedIds: string[];
      platformRecommendationIds: string[];
      taskRecommendationIds: string[];
      eventLog: ReturnType<typeof createStorefrontState>["eventLog"];
    };
  }
}

function ProductCard({
  product,
  action,
  disabled = false
}: {
  product: Product;
  action?: () => void;
  disabled?: boolean;
}) {
  return (
    <article className="store-product" data-product-id={product.id}>
      <span>{product.category.replaceAll("-", " ")}</span>
      <h3>{product.name}</h3>
      <dl>
        <div><dt>Nutrition</dt><dd>{Math.round(product.attributes.nutrition * 100)}</dd></div>
        <div><dt>Plant</dt><dd>{Math.round(product.attributes.plantBased * 100)}</dd></div>
      </dl>
      {action && (
        <button
          data-action="view-product"
          disabled={disabled}
          onClick={action}
          type="button"
        >
          {disabled ? "Viewed" : "View product"}
        </button>
      )}
    </article>
  );
}

function Shelf({
  label,
  products,
  testId
}: {
  label: string;
  products: Product[];
  testId: string;
}) {
  return (
    <section className="store-shelf" data-testid={testId}>
      <header><span>{label}</span><b>TOP 10</b></header>
      <div>
        {products.map((product, index) => (
          <article data-product-id={product.id} key={product.id}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <strong>{product.name}</strong>
            <small>{product.category.replaceAll("-", " ")}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OnlineStorefront() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const arm: ActivationArm = params.get("arm") === "held" ? "held" : "immediate";
  const requestedTask = params.get("task");
  const task = STOREFRONT_TASKS.find((candidate) => candidate.id === requestedTask) ?? STOREFRONT_TASKS[0];
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState(createStorefrontState);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/open-food-facts.snapshot.json`)
      .then((response) => response.json())
      .then((value) => setCatalog(CatalogSchema.parse(value)))
      .catch((error) => {
        throw error;
      });
  }, []);

  const taskProfile = catalog ? taskLocalProfile(catalog, task, state.viewedIds) : null;
  const platformRecommendations = catalog
    ? rankProducts(catalog, state.platformProfile)
    : [];
  const taskRecommendations = catalog && taskProfile
    ? rankProducts(catalog, taskProfile, task.category)
    : [];
  const results = catalog && query.trim() ? searchProducts(catalog, task) : [];

  useEffect(() => {
    window.__STORE_RESEARCH__ = {
      phase: state.phase,
      arm,
      taskId: task.id,
      viewedIds: state.viewedIds,
      stagedIds: state.stagedIds,
      platformRecommendationIds: platformRecommendations.map((product) => product.id),
      taskRecommendationIds: taskRecommendations.map((product) => product.id),
      eventLog: state.eventLog
    };
  }, [arm, platformRecommendations, state, task.id, taskRecommendations]);

  if (!catalog) {
    return <main className="store-loading">Loading the research storefront…</main>;
  }

  const chosenId = state.viewedIds[0] ?? null;
  const resolved = state.phase === "outcome-resolved" || state.phase === "next-task";

  return (
    <main className="research-storefront" data-arm={arm} data-phase={state.phase}>
      <nav className="store-nav">
        <a href={import.meta.env.BASE_URL}>ACI / RESEARCH STORE</a>
        <span>FROZEN OPEN DATA · NO PURCHASES</span>
      </nav>

      <header className="store-hero">
        <div>
          <span>ONLINE ACTIVATION STUDY / {arm === "held" ? "HOLD UNTIL RESOLVED" : "ACTIVATE IMMEDIATELY"}</span>
          <h1>{task.label}</h1>
        </div>
        <dl>
          <div><dt>Checkpoint</dt><dd>{state.phase.replaceAll("-", " ")}</dd></div>
          <div><dt>Task evidence</dt><dd>{state.viewedIds.length}</dd></div>
          <div><dt>Platform eligible</dt><dd>{state.eventLog.filter((event) => event.eligibleForPlatform).length}</dd></div>
          <div><dt>Held</dt><dd>{state.stagedIds.length}</dd></div>
        </dl>
      </header>

      <section className="store-search" aria-label="Product search">
        <label htmlFor="store-query">Shopping task</label>
        <input
          id="store-query"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={task.query}
          value={query}
        />
        <button data-action="search" onClick={() => setQuery(task.query)} type="button">Search frozen catalog</button>
      </section>

      {results.length > 0 && !resolved && (
        <section className="store-results" data-testid="search-results">
          <header><span>SEARCH RESULTS</span><b>{task.query}</b></header>
          <div>
            {results.map((product) => (
              <ProductCard
                action={() => setState((current) => viewProduct(current, catalog, arm, product.id))}
                disabled={state.viewedIds.includes(product.id)}
                key={product.id}
                product={product}
              />
            ))}
          </div>
        </section>
      )}

      <div className="store-shelves">
        <Shelf label="TASK-LOCAL RECOMMENDATIONS" products={taskRecommendations} testId="task-recommendations" />
        <Shelf label="PRINCIPAL PLATFORM SURFACE" products={platformRecommendations} testId="platform-recommendations" />
      </div>

      {state.phase === "task-in-progress" && state.viewedIds.length >= 3 && (
        <section className="store-resolution">
          <div>
            <span>OUTCOME GATE</span>
            <h2>{task.outcome === "selected" ? "Commit one selected outcome." : "The task ended without a selection."}</h2>
          </div>
          <button
            data-action={`resolve-${task.outcome}`}
            onClick={() => setState((current) => resolveTask(current, catalog, task.outcome, chosenId))}
            type="button"
          >
            Resolve as {task.outcome}
          </button>
        </section>
      )}

      {state.phase === "outcome-resolved" && (
        <section className="store-next">
          <span>RESOLVED STATE RECORDED</span>
          <button data-action="begin-next-task" onClick={() => setState((current) => beginNextTask(current, catalog, task))} type="button">
            Begin standardized next task
          </button>
        </section>
      )}

      <footer className="store-footer">
        <p>Research interface. No account, cart, checkout, payment, or external product navigation is available.</p>
        <p>{catalog.source.attribution}</p>
      </footer>
    </main>
  );
}
