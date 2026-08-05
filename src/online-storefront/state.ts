import type { Catalog, ProfileVector } from "../domain/schema";
import {
  incorporate,
  initialProfile,
  nextTaskProduct,
  type ActivationArm,
  type StorefrontPhase,
  type StorefrontTask
} from "./model";

export interface StorefrontState {
  phase: StorefrontPhase;
  viewedIds: string[];
  selectedId: string | null;
  platformProfile: ProfileVector;
  stagedIds: string[];
  eventLog: Array<{
    sequence: number;
    action: "view" | "select" | "abandon" | "next-task";
    productId: string | null;
    eligibleForPlatform: boolean;
  }>;
}

export function createStorefrontState(): StorefrontState {
  return {
    phase: "task-start",
    viewedIds: [],
    selectedId: null,
    platformProfile: initialProfile(),
    stagedIds: [],
    eventLog: []
  };
}

function append(
  state: StorefrontState,
  event: Omit<StorefrontState["eventLog"][number], "sequence">
) {
  return [...state.eventLog, { ...event, sequence: state.eventLog.length }];
}

export function viewProduct(
  state: StorefrontState,
  catalog: Catalog,
  arm: ActivationArm,
  productId: string
): StorefrontState {
  if (state.phase === "outcome-resolved" || state.phase === "next-task") return state;
  if (state.viewedIds.includes(productId)) return state;
  const product = catalog.products.find((candidate) => candidate.id === productId);
  if (!product) return state;
  const eligible = arm === "immediate";
  return {
    ...state,
    phase: "task-in-progress",
    viewedIds: [...state.viewedIds, productId],
    stagedIds: eligible ? state.stagedIds : [...state.stagedIds, productId],
    platformProfile: eligible
      ? incorporate(state.platformProfile, product, 0.28)
      : state.platformProfile,
    eventLog: append(state, {
      action: "view",
      productId,
      eligibleForPlatform: eligible
    })
  };
}

export function resolveTask(
  state: StorefrontState,
  catalog: Catalog,
  outcome: "selected" | "abandoned",
  selectedId: string | null
): StorefrontState {
  const baseline = initialProfile();
  const selected = selectedId
    ? catalog.products.find((candidate) => candidate.id === selectedId)
    : undefined;
  return {
    ...state,
    phase: "outcome-resolved",
    selectedId: outcome === "selected" ? selectedId : null,
    stagedIds: [],
    platformProfile:
      outcome === "selected" && selected
        ? incorporate(baseline, selected, 0.42)
        : baseline,
    eventLog: append(state, {
      action: outcome === "selected" ? "select" : "abandon",
      productId: outcome === "selected" ? selectedId : null,
      eligibleForPlatform: outcome === "selected"
    })
  };
}

export function beginNextTask(
  state: StorefrontState,
  catalog: Catalog,
  task: StorefrontTask
): StorefrontState {
  const next = nextTaskProduct(catalog, task);
  return {
    ...state,
    phase: "next-task",
    platformProfile: incorporate(state.platformProfile, next, 0.24),
    eventLog: append(state, {
      action: "next-task",
      productId: next.id,
      eligibleForPlatform: true
    })
  };
}
