# Threat model

This document defines the threats the HACP 0.1 reference implementation is designed to address and the responsibilities left to deployments.

## Protected properties

HACP aims to preserve:

- **provenance integrity** — the action traces to an attested Decision;
- **delegation integrity** — authority cannot expand through subdelegation;
- **actor binding** — the authenticated caller is the authorized Agent;
- **effect binding** — verification covers the resolved operation, target, and parameters;
- **freshness** — expired, revoked, and replayed authority is rejected;
- **auditability** — a Receipt identifies the action digest, verdict, policy, and verifier.

## In-scope threats

| Threat | Required mitigation |
| --- | --- |
| Agent fabricates human approval | Decision attestation from an accepted verification method |
| Prompt or extractor changes a constraint | Human review of the canonical Decision and signature over its digest |
| Agent widens scope during delegation | Monotonic attenuation across permissions, constraints, audience, validity, and depth |
| Stolen envelope is replayed | Audience-bound proof, short validity, and atomic nonce consumption |
| Agent lies about its identity | Independent transport authentication bound to `ActionEnvelope.agent` |
| Agent signs a harmless label but sends harmful parameters | Signature and policy evaluation cover the complete canonical action |
| Evidence is replaced later | Immutable evidence digest committed before attestation |
| Mandate is withdrawn | Fresh revocation resolution under receiver policy |
| Verifier behavior changes | Receipt records the exact policy version used |

## Deployment responsibilities

HACP does not secure a system whose surrounding identity, key, or effect controls are broken. Deployments must:

- protect signing keys and rotate compromised material;
- authorize verification methods for identities rather than merely resolving public keys;
- authenticate transport callers independently;
- make nonce consumption atomic across all verifier replicas;
- resolve the actual protected effect before checking constraints;
- prevent time-of-check/time-of-use changes between verification and execution;
- restrict evidence disclosure and audit-log access;
- define availability behavior for key and revocation services;
- obtain a security review before protecting high-impact operations.

## Explicit non-goals

HACP does not:

- prove that natural-language interpretation is semantically correct;
- expose or verify model chain-of-thought;
- create a universal identity or reputation registry;
- replace TLS, OAuth, mTLS, workload identity, or application authorization;
- decide which issuers, assurance levels, or actions a receiver should trust;
- make a malicious protected service honor a valid verdict.

## Fail-closed behavior

Malformed signatures, broken delegation chains, identity mismatches, expired authority, revoked objects, and violated constraints produce `DENY`. Missing domain evaluators or evidence that may be recoverable produce `REVIEW`. Implementations must never convert an unknown critical condition into `ALLOW`.
