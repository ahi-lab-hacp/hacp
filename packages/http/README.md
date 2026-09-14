# `@ahi-lab-hacp/http`

Fetch-compatible HTTP binding for HACP 0.1.

```ts
import {
  createHacpDiscoveryDocument,
  createHacpDiscoveryResponse,
  createHacpHandler,
  createHacpRequest,
  requireHacp,
  verifyHacpRequest,
} from "@ahi-lab-hacp/http";
```

The binding sends an ActionEnvelope using `application/hacp+json` and `HACP-Version: 0.1`. The server API requires an independently authenticated agent identity and delegates protocol verification to `@ahi-lab-hacp/core`.

See [HTTP binding guidance](../../docs/http-binding.md) and the [complete example](../../examples/basic/src/index.ts).

## Protect a consequential operation

`requireHacp()` is a Fetch-compatible, default-deny receiver boundary. The
protected callback is never called unless authentication, provenance,
delegation, constraints, replay protection, and receiver policy all produce an
`ALLOW` Receipt.

```ts
const purchaseTicket = requireHacp({
  authenticateAgent: authenticateWorkload,
  resolveDecision,
  resolveMandate,
  resolveKey,
  authorizeVerificationMethod,
  revocations,
  nonces,
  verifier: "https://tickets.example/hacp/verifier",
  receiptSigner,
  policy: ticketPolicy,
  onAllow: ({ verification }) =>
    createBooking(verification.action!, verification.receipt),
});

export default { fetch: purchaseTicket };
```

This shape runs directly in Fetch-compatible runtimes. Framework adapters must
derive `authenticatedAgent` from trusted transport authentication, never from
the signed request body.

## Publish receiver discovery

Publish public verification material and accepted actions at
`/.well-known/hacp.json`. The helper deliberately copies only public key fields
so key-management objects cannot accidentally serialize private material.

```ts
const discovery = createHacpDiscoveryDocument({
  issuer: "https://tickets.example/hacp",
  verifier: "https://tickets.example/hacp/verifier",
  audience: "https://tickets.example",
  verificationMethods: [{
    id: "https://tickets.example/.well-known/hacp.json#receipt-key-1",
    controller: "https://tickets.example/hacp/verifier",
    algorithm: "Ed25519",
    publicKeyJwk: receiptPublicJwk,
  }],
  actions: [{
    action: "flight.purchase",
    assuranceLevels: ["HACP_L2", "HACP_L3"],
  }],
});

const response = createHacpDiscoveryResponse(discovery);
```
