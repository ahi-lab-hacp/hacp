import { randomUUID } from "node:crypto";
import { actionEnvelopePayload } from "./action.js";
import { digestObject } from "./canonicalize.js";
import { evaluateConstraints, isConstraintSetNarrower } from "./constraints.js";
import { createProof, verifyProof, withoutProof } from "./crypto.js";
import { decisionAttestationPayload, verifyDecisionAttestation } from "./decision.js";
import { HacpError } from "./errors.js";
import { evaluateIntent } from "./intent.js";
import { mandatePayload } from "./mandate.js";
import {
  type Action,
  type Decision,
  HACP_VERSION,
  type Mandate,
  type Receipt,
  type Signer,
  type Verdict,
  type VerificationOptions,
  type VerificationResult,
} from "./types.js";

interface ReceiptInput {
  actionDigest: string;
  mandateRef: string;
  policyVersion: string;
  reasonCodes: string[];
  signer: Signer;
  verifier: string;
  verdict: Verdict;
  now: Date;
}

function createReceipt(input: ReceiptInput): Receipt {
  const unsigned: Omit<Receipt, "proof"> = {
    hacpVersion: HACP_VERSION,
    type: "receipt",
    id: `rcpt_${randomUUID()}`,
    verifier: input.verifier,
    verdict: input.verdict,
    actionDigest: input.actionDigest,
    mandateRef: input.mandateRef,
    reasonCodes: input.reasonCodes,
    policyVersion: input.policyVersion,
    evaluatedAt: input.now.toISOString(),
  };
  return { ...unsigned, proof: createProof(unsigned, "hacp:receipt", input.signer) };
}

export function receiptPayload(receipt: Receipt): Omit<Receipt, "proof"> {
  return withoutProof(receipt);
}

async function resolveMandateChain(options: VerificationOptions): Promise<Mandate[]> {
  const reversed: Mandate[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = options.actionEnvelope.mandateRef;
  const maximum = options.maximumDelegationDepth ?? 8;

  while (currentId) {
    if (seen.has(currentId)) throw new HacpError("INVALID_MANDATE", "Mandate cycle detected");
    if (reversed.length > maximum) {
      throw new HacpError("INVALID_MANDATE", "Mandate chain exceeds the configured maximum");
    }
    seen.add(currentId);
    const mandate = await options.resolveMandate(currentId);
    reversed.push(mandate);
    currentId = mandate.parentMandateRef;
  }

  return reversed.reverse();
}

function includesAudience(mandate: Mandate, audience: string): boolean {
  return mandate.audience.includes(audience);
}

function timeIsValid(iso: string): boolean {
  return Number.isFinite(Date.parse(iso));
}

async function verifyDecision(decision: Decision, options: VerificationOptions): Promise<boolean> {
  if (!(await verifyDecisionAttestation(decision, options.resolveKey))) return false;
  const proof = decision.attestation?.proof;
  if (!proof) return false;
  const principalIds = [decision.principal.id, decision.principal.organization].filter(
    (value): value is string => Boolean(value),
  );
  for (const identity of principalIds) {
    if (await options.authorizeVerificationMethod(identity, proof.verificationMethod)) return true;
  }
  return false;
}

async function verifyMandateChain(
  chain: Mandate[],
  decision: Decision,
  options: VerificationOptions,
): Promise<string[]> {
  const reasons: string[] = [];
  const narrowing = options.isConstraintSetNarrower ?? isConstraintSetNarrower;

  for (const [index, mandate] of chain.entries()) {
    if (mandate.hacpVersion !== HACP_VERSION || mandate.type !== "mandate") {
      reasons.push("INVALID_MANDATE_TYPE_OR_VERSION");
      continue;
    }
    if (mandate.decisionRef !== decision.id) reasons.push("DECISION_CHAIN_MISMATCH");
    if (
      !(await verifyProof(
        mandatePayload(mandate),
        "hacp:mandate",
        mandate.proof,
        options.resolveKey,
      ))
    ) {
      reasons.push("MANDATE_SIGNATURE_INVALID");
    }
    if (
      !(await options.authorizeVerificationMethod(mandate.issuer, mandate.proof.verificationMethod))
    ) {
      reasons.push("MANDATE_SIGNER_NOT_AUTHORIZED");
    }

    const parent = index > 0 ? chain[index - 1] : undefined;
    if (!parent) {
      const roots = [decision.principal.id, decision.principal.organization].filter(Boolean);
      if (!roots.includes(mandate.issuer)) reasons.push("ROOT_ISSUER_NOT_AUTHORIZED");
      if (!(await narrowing(mandate.constraints, decision.constraints))) {
        reasons.push("ROOT_CONSTRAINT_ESCALATION");
      }
      if (!mandate.permissions.every((permission) => permission === decision.intent.type)) {
        reasons.push("INTENT_PERMISSION_ESCALATION");
      }
      continue;
    }

    if (mandate.issuer !== parent.subject) reasons.push("DELEGATION_IDENTITY_DISCONTINUITY");
    if (mandate.parentMandateRef !== parent.id) reasons.push("DELEGATION_REFERENCE_MISMATCH");
    if (parent.maxDelegationDepth < 1) reasons.push("DELEGATION_NOT_PERMITTED");
    if (mandate.maxDelegationDepth >= parent.maxDelegationDepth) {
      reasons.push("DELEGATION_DEPTH_NOT_ATTENUATED");
    }
    if (!mandate.permissions.every((permission) => parent.permissions.includes(permission))) {
      reasons.push("PERMISSION_ESCALATION");
    }
    if (!mandate.audience.every((audience) => parent.audience.includes(audience))) {
      reasons.push("AUDIENCE_ESCALATION");
    }
    if (Date.parse(mandate.notAfter) > Date.parse(parent.notAfter)) {
      reasons.push("VALIDITY_ESCALATION");
    }
    if (!(await narrowing(mandate.constraints, parent.constraints))) {
      reasons.push("CONSTRAINT_ESCALATION");
    }
  }
  return reasons;
}

function resultWithReceipt(
  options: VerificationOptions,
  now: Date,
  verdict: Verdict,
  reasonCodes: string[],
  context?: { action: Action; decision: Decision; mandateChain: Mandate[] },
): VerificationResult {
  return {
    receipt: createReceipt({
      actionDigest: digestObject(options.actionEnvelope),
      mandateRef: options.actionEnvelope.mandateRef,
      policyVersion: options.policy.version,
      reasonCodes: [...new Set(reasonCodes)],
      signer: options.receiptSigner,
      verifier: options.verifier,
      verdict,
      now,
    }),
    ...(context
      ? {
          action: context.action,
          decision: context.decision,
          mandateChain: context.mandateChain,
        }
      : {}),
  };
}

/**
 * Performs the HACP verification algorithm. Expected authorization failures
 * are returned as signed DENY/REVIEW receipts; malformed integration errors throw.
 */
export async function verifyAction(options: VerificationOptions): Promise<VerificationResult> {
  const now = options.now?.() ?? new Date();
  const envelope = options.actionEnvelope;
  const deny = (reasons: string[]) => resultWithReceipt(options, now, "DENY", reasons);

  try {
    if (envelope.hacpVersion !== HACP_VERSION || envelope.type !== "action-envelope") {
      return deny(["VERSION_OR_TYPE_NOT_SUPPORTED"]);
    }
    if (!timeIsValid(envelope.createdAt)) return deny(["ACTION_TIME_INVALID"]);

    const actionProofValid = await verifyProof(
      actionEnvelopePayload(envelope),
      "hacp:action",
      envelope.proof,
      options.resolveKey,
    );
    if (!actionProofValid) return deny(["ACTION_SIGNATURE_INVALID"]);
    if (
      !(await options.authorizeVerificationMethod(
        envelope.agent,
        envelope.proof.verificationMethod,
      ))
    ) {
      return deny(["ACTION_SIGNER_NOT_AUTHORIZED"]);
    }
    if (envelope.agent !== options.authenticatedAgent) {
      return deny(["AGENT_AUTHENTICATION_FAILED"]);
    }

    const chain = await resolveMandateChain(options);
    const leaf = chain.at(-1);
    if (!leaf) return deny(["MANDATE_NOT_FOUND"]);
    const decision = await options.resolveDecision(leaf.decisionRef);
    if (!(await verifyDecision(decision, options))) return deny(["DECISION_ATTESTATION_INVALID"]);

    const chainReasons = await verifyMandateChain(chain, decision, options);
    if (chainReasons.length > 0) return deny(chainReasons);

    if (leaf.subject !== envelope.agent) return deny(["MANDATE_SUBJECT_MISMATCH"]);
    if (!includesAudience(leaf, options.audience)) return deny(["AUDIENCE_MISMATCH"]);

    const skew = options.clockSkewMs ?? 60_000;
    const createdAt = Date.parse(envelope.createdAt);
    if (createdAt > now.getTime() + skew) return deny(["ACTION_CREATED_IN_FUTURE"]);
    if (!timeIsValid(leaf.validFrom) || !timeIsValid(leaf.notAfter)) {
      return deny(["MANDATE_TIME_INVALID"]);
    }
    if (now.getTime() + skew < Date.parse(leaf.validFrom)) return deny(["MANDATE_NOT_YET_VALID"]);
    if (now.getTime() - skew >= Date.parse(leaf.notAfter)) return deny(["MANDATE_EXPIRED"]);

    for (const mandate of chain) {
      if (await options.revocations.isRevoked(mandate.id, now)) return deny(["MANDATE_REVOKED"]);
    }
    if (await options.revocations.isRevoked(decision.id, now)) return deny(["DECISION_REVOKED"]);
    if (!leaf.permissions.includes(envelope.action.type)) return deny(["ACTION_OUT_OF_SCOPE"]);

    const context = { action: envelope.action, decision, mandateChain: chain };
    const intentResult = await (options.evaluateIntent ?? evaluateIntent)(
      decision.intent,
      envelope.action,
    );
    if (intentResult.verdict !== "ALLOW") {
      return resultWithReceipt(
        options,
        now,
        intentResult.verdict,
        intentResult.reasonCodes,
        context,
      );
    }

    const evaluate = options.evaluateConstraints ?? evaluateConstraints;
    const constraintResult = await evaluate(leaf.constraints, envelope.action);
    if (constraintResult.verdict !== "ALLOW") {
      return resultWithReceipt(
        options,
        now,
        constraintResult.verdict,
        constraintResult.reasonCodes,
        context,
      );
    }

    const nonceAccepted = await options.nonces.consume(
      `${options.audience}|${envelope.agent}`,
      envelope.nonce,
      new Date(leaf.notAfter),
    );
    if (!nonceAccepted) return deny(["REPLAY_DETECTED"]);

    const policy = await options.policy.evaluate({
      action: envelope.action,
      authenticatedAgent: options.authenticatedAgent,
      decision,
      mandateChain: chain,
    });
    const reasons = [
      "DECISION_ATTESTATION_VALID",
      "AGENT_IDENTITY_BOUND",
      "MANDATE_CHAIN_VALID",
      "INTENT_MATCH",
      "WITHIN_SCOPE",
      ...(policy.reasonCodes ?? []),
    ];
    return resultWithReceipt(options, now, policy.verdict, reasons, context);
  } catch (error) {
    if (error instanceof HacpError) return deny([error.code]);
    throw error;
  }
}

export async function verifyReceipt(
  receipt: Receipt,
  resolveKey: VerificationOptions["resolveKey"],
): Promise<boolean> {
  return verifyProof(receiptPayload(receipt), "hacp:receipt", receipt.proof, resolveKey);
}

export function getDecisionAttestationPayload(decision: Decision): unknown {
  return decisionAttestationPayload(decision);
}
