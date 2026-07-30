import { AXES, type ProfileVector } from "../domain/schema";

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function zeroVector(): ProfileVector {
  return {
    nutrition: 0,
    sustainability: 0,
    plantBased: 0,
    lowProcessing: 0,
    indulgence: 0
  };
}

export function mapVector(
  vector: ProfileVector,
  mapper: (value: number, axis: (typeof AXES)[number]) => number
): ProfileVector {
  return Object.fromEntries(
    AXES.map((axis) => [axis, mapper(vector[axis], axis)])
  ) as ProfileVector;
}

export function add(
  left: ProfileVector,
  right: ProfileVector
): ProfileVector {
  return mapVector(left, (value, axis) => value + right[axis]);
}

export function subtract(
  left: ProfileVector,
  right: ProfileVector
): ProfileVector {
  return mapVector(left, (value, axis) => value - right[axis]);
}

export function scale(vector: ProfileVector, scalar: number): ProfileVector {
  return mapVector(vector, (value) => value * scalar);
}

export function blend(
  current: ProfileVector,
  target: ProfileVector,
  rate: number
): ProfileVector {
  return mapVector(current, (value, axis) =>
    clamp01(value + (target[axis] - value) * rate)
  );
}

export function dot(
  left: ProfileVector,
  right: ProfileVector
): number {
  return (
    AXES.reduce((total, axis) => total + left[axis] * right[axis], 0) /
    AXES.length
  );
}

export function normalizedDistance(
  left: ProfileVector,
  right: ProfileVector
): number {
  const squared = AXES.reduce(
    (total, axis) => total + (left[axis] - right[axis]) ** 2,
    0
  );
  return Math.sqrt(squared / AXES.length);
}

export function roundVector(
  vector: ProfileVector,
  digits = 6
): ProfileVector {
  const factor = 10 ** digits;
  return mapVector(vector, (value) => Math.round(value * factor) / factor);
}
