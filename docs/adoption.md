# Experimental adoption guide

HACP 0.1 is an experimental specification and reference implementation. This
guide describes how Agents and Receivers can evaluate it without prematurely
making it a sole production security dependency.

## Recommended progression

### 1. Observe

- Agents attach HACP objects to a non-production or mirrored request path.
- Receivers verify the objects and retain the Receipt without changing the
  external effect.
- Teams compare HACP verdicts with existing authorization and business policy.
- Missing HACP evidence does not block legacy traffic.

Exit this mode only after identities, keys, clocks, resolvers, revocations,
nonce storage, and domain constraint evaluators behave reliably.

### 2. Prefer

- Valid HACP provenance may reduce manual review or select a narrowly scoped
  automation path.
- Existing authentication, authorization, fraud, and safety controls remain
  mandatory.
- Invalid or unavailable HACP evidence falls back to the existing safe path.

### 3. Require for selected actions

- Choose a small set of consequential operations with machine-evaluable intent
  and constraints.
- Reject missing, invalid, expired, revoked, replayed, or out-of-scope evidence
  for those operations.
- Maintain a tested rollback path and a human recovery process.
- Monitor false allows, false denies, review rates, latency, and dependency
  availability.

### 4. HACP-only

General HACP-only production enforcement is not recommended while the protocol
is experimental and independently unaudited. A future deployment considering
this mode should require independent security review, interoperable
implementations, stable conformance behavior, incident procedures, and proven
operational recovery.

## Agent integration

An Agent integration should:

1. extract a non-authoritative proposed Decision;
2. present the canonical intent and constraints to the human or institutional
   authority;
3. attest only after separately authenticated approval;
4. request the narrowest useful Mandate;
5. create an ActionEnvelope for the exact external effect;
6. keep signing keys outside the model runtime; and
7. request new approval when consequential intent changes.

## Receiver integration

A Receiver should:

1. authenticate the calling Agent independently of the HACP body;
2. resolve trusted public keys, Decisions, Mandates, and revocations;
3. bind the caller to the Mandate and ActionEnvelope identities;
4. evaluate the exact action against signed intent, constraints, audience, and
   local policy;
5. atomically consume replay nonces;
6. execute the protected effect only after `ALLOW`; and
7. retain the signed Receipt with the effect audit record.

HACP supplements TLS, workload authentication, application authorization,
sandboxing, fraud controls, prompt-injection defenses, and receiver policy. It
does not replace them.

## Feedback requested

Useful experimental reports include:

- the Agent and Receiver stacks used;
- the HACP roles implemented;
- conformance vectors executed;
- ambiguous specification language;
- interoperability failures;
- operational false allows, false denies, or `REVIEW` outcomes; and
- missing domain constraint semantics.

Submit an implementation report through the repository issue template. Submit
non-sensitive design feedback through the review-feedback template. Report
potential vulnerabilities privately according to [SECURITY.md](../SECURITY.md).
