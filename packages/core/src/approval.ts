import { attestDecisionWithProvider, decisionDigest } from "./decision.js";
import { invariant } from "./errors.js";
import type { Decision, SigningProvider } from "./types.js";

export interface ApprovalGrant {
  approvedAt: string;
  authenticationMethod: string;
  decisionDigest: string;
  expiresAt: string;
  id: string;
  principal: string;
}

export interface ApprovalGrantStore {
  /** Atomically consumes a one-time grant bound to the expected Decision digest. */
  consume(id: string, expectedDecisionDigest: string): ApprovalGrant | Promise<ApprovalGrant>;
}

export interface AttestApprovedDecisionOptions {
  approvalId: string;
  approvals: ApprovalGrantStore;
  decision: Decision;
  now?: () => Date;
  signer: SigningProvider;
}

/**
 * Authority-service helper that requires a one-time, externally authenticated
 * approval bound to the exact proposed Decision before isolated signing.
 */
export async function attestApprovedDecisionWithProvider(
  options: AttestApprovedDecisionOptions,
): Promise<Decision> {
  const digest = decisionDigest(options.decision);
  const approval = await options.approvals.consume(options.approvalId, digest);
  const now = options.now?.() ?? new Date();

  invariant(
    approval.decisionDigest === digest,
    "DECISION_NOT_ATTESTED",
    "Approval is not bound to this Decision",
  );
  invariant(
    approval.principal === options.decision.principal.id,
    "DECISION_NOT_ATTESTED",
    "Approval principal does not match the Decision",
  );
  invariant(
    Boolean(approval.authenticationMethod),
    "DECISION_NOT_ATTESTED",
    "Approval authentication method is required",
  );
  invariant(
    Number.isFinite(Date.parse(approval.approvedAt)) &&
      Number.isFinite(Date.parse(approval.expiresAt)) &&
      Date.parse(approval.approvedAt) <= now.getTime() &&
      now.getTime() < Date.parse(approval.expiresAt),
    "DECISION_NOT_ATTESTED",
    "Approval is not currently valid",
  );

  return attestDecisionWithProvider({ decision: options.decision, signer: options.signer });
}
