import { canonicalize } from "./canonicalize.js";
import type { Action, ConstraintEvaluation, ConstraintSet, JsonValue } from "./types.js";

function equal(left: JsonValue, right: JsonValue): boolean {
  return canonicalize(left) === canonicalize(right);
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : undefined;
}

function decimal(value: JsonValue | undefined): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isNarrowerValue(child: JsonValue, parent: JsonValue, key: string): boolean {
  if (key === "maxAmount") {
    const childAmount = asRecord(child);
    const parentAmount = asRecord(parent);
    if (!childAmount || !parentAmount || childAmount.currency !== parentAmount.currency)
      return false;
    const childValue = decimal(childAmount.value);
    const parentValue = decimal(parentAmount.value);
    return childValue !== undefined && parentValue !== undefined && childValue <= parentValue;
  }

  if (key === "notAfter") {
    const childTime = typeof child === "string" ? Date.parse(child) : Number.NaN;
    const parentTime = typeof parent === "string" ? Date.parse(parent) : Number.NaN;
    return Number.isFinite(childTime) && Number.isFinite(parentTime) && childTime <= parentTime;
  }

  if (Array.isArray(parent)) {
    if (!Array.isArray(child)) return parent.some((item) => equal(item, child));
    return child.every((item) => parent.some((candidate) => equal(candidate, item)));
  }

  if (typeof parent === "number" && typeof child === "number") return child <= parent;
  return equal(child, parent);
}

/** Fail-closed default attenuation check for common constraint shapes. */
export function isConstraintSetNarrower(child: ConstraintSet, parent: ConstraintSet): boolean {
  return Object.entries(parent).every(([key, parentValue]) => {
    const childValue = child[key];
    return childValue !== undefined && isNarrowerValue(childValue, parentValue, key);
  });
}

function evaluateMaxAmount(limit: JsonValue, action: Action): boolean | undefined {
  const constraint = asRecord(limit);
  const amount = asRecord(action.parameters.amount);
  if (!constraint || !amount || constraint.currency !== amount.currency) return undefined;
  const maximum = decimal(constraint.value);
  const actual = decimal(amount.value);
  return maximum !== undefined && actual !== undefined ? actual <= maximum : undefined;
}

function evaluateTarget(allowed: JsonValue, action: Action): boolean | undefined {
  if (!Array.isArray(allowed) || !allowed.every((value) => typeof value === "string")) {
    return undefined;
  }
  return allowed.some(
    (prefix) => action.target === prefix || action.target.startsWith(`${prefix}/`),
  );
}

function evaluateParameter(
  constraint: JsonValue,
  actual: JsonValue | undefined,
): boolean | undefined {
  if (actual === undefined) return undefined;
  if (Array.isArray(constraint)) {
    if (Array.isArray(actual)) {
      return actual.every((item) => constraint.some((candidate) => equal(candidate, item)));
    }
    return constraint.some((candidate) => equal(candidate, actual));
  }
  return equal(constraint, actual);
}

/**
 * Evaluates common protocol-neutral constraints. Domain constraints should be
 * handled by a custom evaluator. Unknown constraints return REVIEW, never ALLOW.
 */
export function evaluateConstraints(
  constraints: ConstraintSet,
  action: Action,
): ConstraintEvaluation {
  const reasons: string[] = [];
  let needsReview = false;

  for (const [key, constraint] of Object.entries(constraints)) {
    let result: boolean | undefined;
    if (key === "maxAmount") result = evaluateMaxAmount(constraint, action);
    else if (key === "allowedTargets") result = evaluateTarget(constraint, action);
    else if (key === "notAfter") continue;
    else result = evaluateParameter(constraint, action.parameters[key]);

    if (result === false) reasons.push(`CONSTRAINT_VIOLATION:${key}`);
    if (result === undefined) {
      needsReview = true;
      reasons.push(`CONSTRAINT_REQUIRES_EVALUATOR:${key}`);
    }
  }

  if (reasons.some((reason) => reason.startsWith("CONSTRAINT_VIOLATION:"))) {
    return { verdict: "DENY", reasonCodes: reasons };
  }
  if (needsReview) return { verdict: "REVIEW", reasonCodes: reasons };
  return { verdict: "ALLOW", reasonCodes: ["CONSTRAINTS_SATISFIED"] };
}
