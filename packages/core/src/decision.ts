import { randomUUID } from "node:crypto";
import { digestObject, sha256 } from "./canonicalize.js";
import { createProof, verifyProof } from "./crypto.js";
import { invariant } from "./errors.js";
import {
  type AssuranceLevel,
  type AttestationMethod,
  type Decision,
  type DecisionExtractor,
  type EvidenceRef,
  HACP_VERSION,
  type KeyResolver,
  type Principal,
  type Signer,
} from "./types.js";

export interface ExtractDecisionOptions {
  communication: string;
  principal: Principal;
  extractor: DecisionExtractor;
  mediaType?: string;
  source?: string;
  id?: string;
  now?: () => Date;
}

export function createEvidenceRef(
  communication: string,
  options: { mediaType?: string; source?: string } = {},
): EvidenceRef {
  return {
    digest: `sha256:${sha256(communication)}`,
    disclosure: "DIGEST_ONLY",
    mediaType: options.mediaType ?? "text/plain",
    ...(options.source ? { source: options.source } : {}),
  };
}

/**
 * Produces a non-authoritative Decision proposal through a caller-provided
 * extraction adapter. The result cannot authorize an action until attested.
 */
export async function extractDecision(options: ExtractDecisionOptions): Promise<Decision> {
  const evidence = createEvidenceRef(options.communication, options);
  const extraction = await options.extractor.extract({
    communication: options.communication,
    principal: options.principal,
    evidence,
  });

  invariant(extraction.intent.type.length > 0, "MALFORMED_ENVELOPE", "Intent type is required");
  invariant(
    extraction.intent.statement.length > 0,
    "MALFORMED_ENVELOPE",
    "Intent statement is required",
  );

  return {
    hacpVersion: HACP_VERSION,
    type: "decision",
    id: options.id ?? `dec_${randomUUID()}`,
    state: "PROPOSED",
    principal: options.principal,
    intent: extraction.intent,
    constraints: extraction.constraints,
    evidence: [evidence],
    fieldSources: extraction.fieldSources,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
  };
}

export interface AttestDecisionOptions {
  assuranceLevel?: AssuranceLevel;
  decision: Decision;
  method?: AttestationMethod;
  signer: Signer;
}

export function decisionAttestationPayload(decision: Decision): Omit<Decision, "attestation"> {
  const { attestation: _attestation, ...unsigned } = decision;
  return unsigned;
}

export function attestDecision(options: AttestDecisionOptions): Decision {
  invariant(
    options.decision.state === "PROPOSED",
    "DECISION_NOT_ATTESTED",
    "Only a proposed Decision can be attested",
  );

  const unsigned: Decision = { ...options.decision, state: "ATTESTED" };
  const payload = decisionAttestationPayload(unsigned);
  const proof = createProof(payload, "hacp:decision-attestation", options.signer);

  return {
    ...unsigned,
    attestation: {
      method: options.method ?? "DIRECT_CONFIRMATION",
      assuranceLevel: options.assuranceLevel ?? "HACP_L2",
      attestedAt: proof.createdAt,
      proof,
    },
  };
}

export async function verifyDecisionAttestation(
  decision: Decision,
  resolveKey: KeyResolver,
): Promise<boolean> {
  if (decision.state !== "ATTESTED" || !decision.attestation) return false;
  return verifyProof(
    decisionAttestationPayload(decision),
    "hacp:decision-attestation",
    decision.attestation.proof,
    resolveKey,
  );
}

export function decisionDigest(decision: Decision): string {
  return digestObject(decision);
}
