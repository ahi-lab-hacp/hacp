# HACP ticket-booking demo

This runnable example shows why authentication alone is insufficient for agent traffic. A ticket API can authenticate a travel agent, but it still needs to know which person authorized the booking, the price and destination limits they approved, and whether the request was modified or replayed.

The demo uses the public APIs from `@ahi-lab-hacp/core` and `@ahi-lab-hacp/http`:

```mermaid
sequenceDiagram
  actor Alice
  participant Agent as Travel agent
  participant HACP as HACP library
  participant API as Ticket API
  Alice->>Agent: Book Friday PM to NYC, max $600
  Agent->>HACP: extractDecision(...)
  HACP-->>Alice: PROPOSED Decision for review
  Alice->>HACP: attestDecision(...)
  HACP-->>Agent: Decision + scoped Mandate
  Agent->>HACP: createActionEnvelope(...)
  Agent->>API: authenticated HTTP request + signed envelope
  API->>HACP: verify identity, proofs, scope, price, nonce, policy
  HACP-->>API: signed ALLOW / DENY Receipt
  API-->>Agent: booking result + Receipt
```

## Run it

From the repository root:

```bash
pnpm install
pnpm --filter @hacp-example/ticket-booking start
```

The output shows five requests:

| Scenario | Expected result | Why |
| --- | --- | --- |
| Wrong authenticated agent | `DENY` | Transport identity does not match the signed agent identity |
| Price above $600 | `DENY` | The concrete action exceeds Alice's mandate |
| Destination changed after signing | `DENY` | The ActionEnvelope signature no longer verifies |
| Authorized $542 NYC booking | `ALLOW` | Identity, provenance, scope, constraints, and policy all pass |
| Replay of the allowed request | `DENY` | The one-time action nonce has already been consumed |

Every response contains a verifier-signed Receipt, including denials. The example validates every Receipt signature before displaying the result.

## Follow the implementation

Read [`src/demo.ts`](./src/demo.ts) in numbered sections:

1. `extractDecision()` creates a non-authoritative proposal from natural language.
2. `attestDecision()` and `issueMandate()` bind human approval to a named agent and constraints.
3. `createActionEnvelope()` signs the exact proposed purchase.
4. `createHacpRequest()` carries it over HTTP alongside independent authentication.
5. `createHacpHandler()` verifies the chain and runs the ticket site's local policy.

The example uses in-memory keys and stores for clarity. Production systems should use managed signing keys, durable object resolution, atomic shared nonce storage, revocation checks, and real workload authentication.
