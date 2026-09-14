# Roadmap

## HACP 0.1 — Reference foundation

- Canonical Decision, Mandate, ActionEnvelope, Receipt, and RevocationRecord objects
- Ed25519 signing and verification profile
- Human versus institutional attestation levels
- Monotonic delegation attenuation
- Receiver-side identity, audience, time, nonce, scope, constraint, revocation, and policy checks
- Mandatory intent-to-action binding and one-time approval-grant integration
- Isolated signing, verified revocation, durable nonce, and key-lifecycle adapters
- Fetch-compatible HTTP binding
- JSON Schema and canonicalization vectors
- TypeScript SDK, CLI, tests, examples, CI, and documented manual releases

## HACP 0.2 — Interoperability

- Independent implementation feedback
- Expanded positive and negative signature vectors
- Database-specific durable nonce and revocation adapters
- OpenAPI description for the HTTP binding
- Standards-aligned signature profile evaluation using RFC 8785, RFC 9421, JWS, and W3C Data Integrity
- Public `/.well-known/hacp.json` discovery profile
- Standard constraint vocabulary registry
- A2A and MCP binding profiles
- Python reference SDK using the same conformance suite

## HACP 0.3 — Operational assurance

- Selective-disclosure evidence profile
- Transparency-log integration profile
- Expanded incident-time and historical key verification profiles
- Policy decision interoperability tests
- Go verifier SDK and gateway integration
- External security review

## HACP 1.0 — Stable protocol

- Multiple independent interoperable implementations
- Stable canonicalization and proof suites
- Published compatibility policy
- Complete conformance suite and implementation badges
- Production deployment guidance and threat-model review

Roadmap items are proposals, not commitments. Security and interoperability findings take priority over feature sequencing.
