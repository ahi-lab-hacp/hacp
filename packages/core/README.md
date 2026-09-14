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
