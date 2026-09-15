# HACP npm Agent and Receiver starter

This is the smallest runnable HACP Agent-to-Receiver flow that imports only the
published `@ahi-lab-hacp/core` and `@ahi-lab-hacp/http` npm packages.

It creates:

1. a human-signed `Decision`;
2. a narrow `Mandate` for one Agent;
3. an `ActionEnvelope` for one USD 542 ticket;
4. a Receiver boundary that authenticates and verifies the Agent request; and
5. a signed `ALLOW` `Receipt` before the simulated booking is created.

## Run

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Expected output:

```text
HACP verification: ALLOW
Decision: dec_starter_flight
Mandate: mandate_...
ActionEnvelope: act_...
Receipt: receipt_...
```

The example uses ephemeral local keys, in-memory resolvers, an in-memory nonce
store, and illustrative workload authentication. These are development
utilities. Before a monitored pilot, read the
[experimental adoption guide](../../docs/adoption.md),
[production deployment boundary](../../docs/production-deployment.md), and
[threat model](../../docs/threat-model.md).

Do not use this example as a sole production security boundary.
