import { canonicalize } from "./canonicalize.js";
import type { Action, Intent, IntentEvaluation, JsonValue } from "./types.js";

function matches(expected: JsonValue, actual: JsonValue): boolean {
  return canonicalize(expected) === canonicalize(actual);
}

/**
 * Fail-closed protocol-neutral binding between a signed intent and a concrete
 * action. Domain-specific evaluators may add semantics, but must never treat a
 * missing or contradictory signed intent field as a match.
 */
export function evaluateIntent(intent: Intent, action: Action): IntentEvaluation {
  const reasons: string[] = [];

  if (intent.type !== action.type) reasons.push("INTENT_TYPE_MISMATCH");

  for (const [key, expected] of Object.entries(intent.parameters ?? {})) {
    const actual = action.parameters[key];
    if (actual === undefined) reasons.push(`INTENT_PARAMETER_MISSING:${key}`);
    else if (!matches(expected, actual)) reasons.push(`INTENT_PARAMETER_MISMATCH:${key}`);
  }

  return reasons.length > 0
    ? { verdict: "DENY", reasonCodes: reasons }
    : { verdict: "ALLOW", reasonCodes: ["INTENT_MATCH"] };
}
