export type HacpErrorCode =
  | "ACTION_OUT_OF_SCOPE"
  | "AGENT_AUTHENTICATION_FAILED"
  | "DECISION_NOT_ATTESTED"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_AUDIENCE"
  | "INVALID_MANDATE"
  | "INVALID_PROOF"
  | "INVALID_REVOCATION"
  | "MALFORMED_ENVELOPE"
  | "MANDATE_EXPIRED"
  | "OBJECT_NOT_FOUND"
  | "POLICY_DENIED"
  | "REPLAY_DETECTED"
  | "SCOPE_ESCALATION"
  | "UNSUPPORTED_CONSTRAINT"
  | "VERSION_NOT_SUPPORTED";

export class HacpError extends Error {
  readonly code: HacpErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: HacpErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HacpError";
    this.code = code;
    this.details = details;
  }
}

export function invariant(
  condition: unknown,
  code: HacpErrorCode,
  message: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) throw new HacpError(code, message, details);
}
