# `@ahi-lab-hacp/core`

Transport-neutral TypeScript reference implementation for HACP 0.1.

It provides canonical JSON, Ed25519 proofs, Decision extraction and attestation, Mandate issuance and delegation, ActionEnvelope creation, mandatory intent binding, constraint evaluation, replay protection, revocation records, verification, and signed Receipts.

The default verifier requires the action type and every machine-readable intent
parameter to match the signed Decision. Domain integrations can supply a stricter
`IntentEvaluator`; unknown authorization semantics must fail closed.

```ts
import {
  attestDecision,
  createActionEnvelope,
  extractDecision,
  issueMandate,
  verifyAction,
} from "@ahi-lab-hacp/core";
```

Read the repository [README](../../README.md) for the end-to-end workflow and [security policy](../../SECURITY.md) before integrating consequential actions.

The included in-memory stores are test and development utilities. Production systems need durable, atomic implementations.

## Isolated signing

The synchronous helpers accept local private keys for tests and small trusted
processes. Production systems should use the asynchronous provider helpers so
KMS, HSM, passkey, or authority-service keys never enter the Agent runtime:

```ts
const decision = await attestDecisionWithProvider({
  decision: proposedDecision,
  signer: {
    verificationMethod: "did:web:example.com:alice#authority-1",
    sign: (canonicalBytes, context) => kms.sign(canonicalBytes, context),
  },
});
```

Provider variants are available for Decision attestation, Mandate issuance,
ActionEnvelope creation, revocation, delegated Mandates, and Receipt signing.
The provider must enforce which HACP purpose and identity its key may sign; do
not expose a general-purpose signing endpoint to the model.

`attestApprovedDecisionWithProvider()` additionally requires an atomic,
one-time `ApprovalGrant` bound to the exact proposed Decision digest. The grant
must come from a separately authenticated approval service, not the Agent.

## Verified revocation

`VerifiedRevocationResolver` checks the revocation proof, proof-to-issuer
authorization, object reference, effective time, and deployment-defined issuer
authority. Strict mode is the default and fails closed when a registry returns
an invalid record.

`VerificationMethodRegistry` supports key activation, retirement, compromise
revocation, and historical public-key resolution. `DurableNonceStore` adapts an
atomic database insert to HACP replay protection. See the
[production deployment boundary](../../docs/production-deployment.md).
