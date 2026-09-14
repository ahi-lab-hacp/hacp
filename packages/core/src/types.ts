import type { KeyObject } from "node:crypto";

export const HACP_VERSION = "0.1" as const;

export type HacpVersion = typeof HACP_VERSION;
export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type ConstraintSet = Record<string, JsonValue>;
export type DecisionState = "ATTESTED" | "PROPOSED" | "REVOKED" | "SUPERSEDED";
export type AssuranceLevel = "HACP_L0" | "HACP_L1" | "HACP_L2" | "HACP_L3";
export type AttestationMethod =
  | "DIRECT_CONFIRMATION"
  | "ORGANIZATION_POLICY"
  | "SIGNED_SOURCE"
  | "WITNESSED_APPROVAL";
export type Verdict = "ALLOW" | "DENY" | "REVIEW";
export type KeyMaterial = KeyObject | string | Uint8Array;

export interface Principal {
  id: string;
  type: "HUMAN" | "INSTITUTION";
  organization?: string;
}

export interface Intent {
  type: string;
  statement: string;
  parameters?: Record<string, JsonValue>;
}

export interface EvidenceRef {
  digest: string;
  disclosure: "DIGEST_ONLY" | "SELECTIVE" | "FULL";
  mediaType: string;
  source?: string;
}

export interface FieldSource {
  path: string;
  basis: "ASSERTED" | "INFERRED";
  evidenceDigest?: string;
  confidence?: number;
}

export interface Proof {
  type: "Ed25519Signature2020";
  verificationMethod: string;
  createdAt: string;
  proofValue: string;
}

export interface Attestation {
  method: AttestationMethod;
  assuranceLevel: AssuranceLevel;
  attestedAt: string;
  proof: Proof;
}

export interface Decision {
  hacpVersion: HacpVersion;
  type: "decision";
  id: string;
  state: DecisionState;
  principal: Principal;
  intent: Intent;
  constraints: ConstraintSet;
  evidence: EvidenceRef[];
  fieldSources: FieldSource[];
  createdAt: string;
  attestation?: Attestation;
  supersedes?: string[];
}

export interface Mandate {
  hacpVersion: HacpVersion;
  type: "mandate";
  id: string;
  issuer: string;
  subject: string;
  decisionRef: string;
  parentMandateRef?: string;
  permissions: string[];
  constraints: ConstraintSet;
  audience: string[];
  maxDelegationDepth: number;
  validFrom: string;
  notAfter: string;
  nonce: string;
  proof: Proof;
}

export interface Action {
  type: string;
  target: string;
  parameters: Record<string, JsonValue>;
}

export interface ActionEnvelope {
  hacpVersion: HacpVersion;
  type: "action-envelope";
  id: string;
  mandateRef: string;
  agent: string;
  action: Action;
  nonce: string;
  createdAt: string;
  proof: Proof;
}

export interface Receipt {
  hacpVersion: HacpVersion;
  type: "receipt";
  id: string;
  verifier: string;
  verdict: Verdict;
  actionDigest: string;
  mandateRef: string;
  reasonCodes: string[];
  policyVersion: string;
  evaluatedAt: string;
  proof: Proof;
}

export interface RevocationRecord {
  hacpVersion: HacpVersion;
  type: "revocation";
  id: string;
  issuer: string;
  objectRef: string;
  reason: string;
  effectiveAt: string;
  createdAt: string;
  proof: Proof;
}

export interface Signer {
  privateKey: KeyMaterial;
  verificationMethod: string;
  now?: () => Date;
}

/**
 * Signing boundary for KMS, HSM, passkey, or separately isolated authority
 * services. The private key never enters the HACP caller process.
 */
export interface SigningProvider {
  verificationMethod: string;
  sign(
    bytes: Uint8Array,
    context: { createdAt: string; purpose: string },
  ): Uint8Array | Promise<Uint8Array>;
  now?: () => Date;
}

export type ProofSigner = Signer | SigningProvider;

export type KeyResolver = (verificationMethod: string) => KeyMaterial | Promise<KeyMaterial>;
export type VerificationMethodAuthorizer = (
  identity: string,
  verificationMethod: string,
) => boolean | Promise<boolean>;

export interface DecisionExtraction {
  intent: Intent;
  constraints: ConstraintSet;
  fieldSources: FieldSource[];
}

export interface DecisionExtractor {
  extract(input: {
    communication: string;
    principal: Principal;
    evidence: EvidenceRef;
  }): DecisionExtraction | Promise<DecisionExtraction>;
}

export interface NonceStore {
  consume(scope: string, nonce: string, expiresAt: Date): boolean | Promise<boolean>;
}

export interface RevocationResolver {
  isRevoked(objectRef: string, at: Date): boolean | Promise<boolean>;
}

export interface VerificationContext {
  action: Action;
  authenticatedAgent: string;
  decision: Decision;
  mandateChain: Mandate[];
}

export interface PolicyDecision {
  reasonCodes?: string[];
  verdict: Verdict;
}

export interface VerificationPolicy {
  evaluate(context: VerificationContext): PolicyDecision | Promise<PolicyDecision>;
  version: string;
}

export interface ConstraintEvaluation {
  reasonCodes: string[];
  verdict: Verdict;
}

export interface IntentEvaluation {
  reasonCodes: string[];
  verdict: Verdict;
}

export type IntentEvaluator = (
  intent: Intent,
  action: Action,
) => IntentEvaluation | Promise<IntentEvaluation>;

export type ConstraintEvaluator = (
  constraints: ConstraintSet,
  action: Action,
) => ConstraintEvaluation | Promise<ConstraintEvaluation>;

export type ConstraintNarrowing = (
  child: ConstraintSet,
  parent: ConstraintSet,
) => boolean | Promise<boolean>;

export interface VerificationOptions {
  actionEnvelope: ActionEnvelope;
  authenticatedAgent: string;
  audience: string;
  resolveDecision: (id: string) => Decision | Promise<Decision>;
  resolveMandate: (id: string) => Mandate | Promise<Mandate>;
  resolveKey: KeyResolver;
  authorizeVerificationMethod: VerificationMethodAuthorizer;
  revocations: RevocationResolver;
  nonces: NonceStore;
  policy: VerificationPolicy;
  receiptSigner: ProofSigner;
  verifier: string;
  now?: () => Date;
  clockSkewMs?: number;
  evaluateIntent?: IntentEvaluator;
  evaluateConstraints?: ConstraintEvaluator;
  isConstraintSetNarrower?: ConstraintNarrowing;
  maximumDelegationDepth?: number;
}

export interface VerificationResult {
  receipt: Receipt;
  action?: Action;
  decision?: Decision;
  mandateChain?: Mandate[];
}
