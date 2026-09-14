import { randomUUID } from "node:crypto";
import { createProof, withoutProof } from "./crypto.js";
import { invariant } from "./errors.js";
import { isConstraintSetNarrower } from "./constraints.js";
import {
  HACP_VERSION,
  type ConstraintNarrowing,
  type ConstraintSet,
  type Decision,
  type Mandate,
  type Signer,
} from "./types.js";

export interface IssueMandateOptions {
  audience: string[];
  constraints?: ConstraintSet;
  decision: Decision;
  id?: string;
  issuer: string;
  maxDelegationDepth?: number;
  nonce?: string;
  notAfter: string;
  permissions: string[];
  signer: Signer;
  subject: string;
  validFrom?: string;
}

function assertMandateShape(mandate: Omit<Mandate, "proof">): void {
  invariant(
    mandate.permissions.length > 0,
    "INVALID_MANDATE",
    "At least one permission is required",
  );
  invariant(mandate.audience.length > 0, "INVALID_AUDIENCE", "At least one audience is required");
  invariant(
    Date.parse(mandate.validFrom) < Date.parse(mandate.notAfter),
    "INVALID_MANDATE",
    "Mandate validity interval is invalid",
  );
  invariant(
    Number.isInteger(mandate.maxDelegationDepth) && mandate.maxDelegationDepth >= 0,
    "INVALID_MANDATE",
    "maxDelegationDepth must be a non-negative integer",
  );
}

export function issueMandate(options: IssueMandateOptions): Mandate {
  invariant(
    options.decision.state === "ATTESTED" && options.decision.attestation,
    "DECISION_NOT_ATTESTED",
    "A Mandate requires an attested Decision",
  );
  const now = options.signer.now?.() ?? new Date();
  const unsigned: Omit<Mandate, "proof"> = {
    hacpVersion: HACP_VERSION,
    type: "mandate",
    id: options.id ?? `mandate_${randomUUID()}`,
    issuer: options.issuer,
    subject: options.subject,
    decisionRef: options.decision.id,
    permissions: [...new Set(options.permissions)].sort(),
    constraints: options.constraints ?? options.decision.constraints,
    audience: [...new Set(options.audience)].sort(),
    maxDelegationDepth: options.maxDelegationDepth ?? 0,
    validFrom: options.validFrom ?? now.toISOString(),
    notAfter: options.notAfter,
    nonce: options.nonce ?? randomUUID(),
  };
  assertMandateShape(unsigned);
  invariant(
    isConstraintSetNarrower(unsigned.constraints, options.decision.constraints),
    "SCOPE_ESCALATION",
    "Mandate constraints must preserve or narrow the controlling Decision",
  );
  return { ...unsigned, proof: createProof(unsigned, "hacp:mandate", options.signer) };
}

export interface DelegateMandateOptions {
  audience: string[];
  constraints: ConstraintSet;
  id?: string;
  nonce?: string;
  notAfter: string;
  parent: Mandate;
  permissions: string[];
  signer: Signer;
  subject: string;
  validFrom?: string;
  isNarrower?: ConstraintNarrowing;
}

export async function delegateMandate(options: DelegateMandateOptions): Promise<Mandate> {
  const parent = options.parent;
  const now = options.signer.now?.() ?? new Date();
  invariant(parent.maxDelegationDepth > 0, "SCOPE_ESCALATION", "Parent forbids subdelegation");
  invariant(
    options.permissions.every((permission) => parent.permissions.includes(permission)),
    "SCOPE_ESCALATION",
    "Child permissions exceed the parent",
  );
  invariant(
    options.audience.every((audience) => parent.audience.includes(audience)),
    "SCOPE_ESCALATION",
    "Child audience exceeds the parent",
  );
  invariant(
    Date.parse(options.notAfter) <= Date.parse(parent.notAfter),
    "SCOPE_ESCALATION",
    "Child validity exceeds the parent",
  );
  const narrower = options.isNarrower ?? isConstraintSetNarrower;
  invariant(
    await narrower(options.constraints, parent.constraints),
    "SCOPE_ESCALATION",
    "Child constraints do not monotonically attenuate the parent",
  );

  const unsigned: Omit<Mandate, "proof"> = {
    hacpVersion: HACP_VERSION,
    type: "mandate",
    id: options.id ?? `mandate_${randomUUID()}`,
    issuer: parent.subject,
    subject: options.subject,
    decisionRef: parent.decisionRef,
    parentMandateRef: parent.id,
    permissions: [...new Set(options.permissions)].sort(),
    constraints: options.constraints,
    audience: [...new Set(options.audience)].sort(),
    maxDelegationDepth: parent.maxDelegationDepth - 1,
    validFrom: options.validFrom ?? now.toISOString(),
    notAfter: options.notAfter,
    nonce: options.nonce ?? randomUUID(),
  };
  assertMandateShape(unsigned);
  return { ...unsigned, proof: createProof(unsigned, "hacp:mandate", options.signer) };
}

export function mandatePayload(mandate: Mandate): Omit<Mandate, "proof"> {
  return withoutProof(mandate);
}
