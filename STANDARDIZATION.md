# HACP standardization and adoption

HACP's goal is independent interoperability: an Agent using one implementation
can present human authorization to a Receiver using another implementation, and
both can validate the same provenance chain without trusting AHI Lab.

HACP is presently an open protocol specification and reference implementation.
It becomes a broadly recognized standard only through public review, independent
implementations, operational evidence, and adoption by a standards-development
community.

## What HACP standardizes

HACP standardizes the authorization semantics connecting:

```text
Human communication
    → reviewed Decision
    → bounded Mandate
    → authenticated Agent action
    → receiver verification
    → signed Receipt
```

It does not attempt to replace TLS, OAuth, workload identity, MCP, A2A, fraud
detection, bot management, or receiver policy. HACP carries the human or
institutional authority those systems do not currently express.

## Standards principles

1. **Receiver sovereignty.** A Receiver always controls its acceptance policy.
2. **No proprietary trust dependency.** Core verification must work without an
   AHI Lab service.
3. **Established cryptography.** New HACP versions should reuse standardized
   canonicalization, signature, key, and HTTP mechanisms.
4. **Fail closed.** Unknown or unavailable authorization evidence cannot result
   in a consequential effect.
5. **Data minimization.** Proof should travel without requiring disclosure of a
   person's entire conversation.
6. **Independent conformance.** Compatibility is demonstrated by common vectors,
   not claimed from similar type definitions.
7. **Open governance.** Material changes receive public rationale, security
   analysis, compatibility review, and documented objections.

## Adoption milestones

### Milestone A — Standards-ready foundation

- Normative, implementation-neutral specification in the repository
- Machine-readable schema and positive and negative vectors
- Threat model, privacy guidance, and assurance definitions
- Public discovery contract and default-deny Receiver middleware
- Inspectable live demonstration with signed artifacts

### Milestone B — Independent interoperability

- TypeScript, Python, and Go implementations
- A public conformance runner
- At least two independently maintained Agent implementations
- At least two independently maintained Receivers
- Published reports for successful and failed interoperability cases

### Milestone C — Operational validation

- Production pilots in more than one application domain
- Durable revocation, nonce, resolver, and key-rotation profiles
- External protocol and cryptographic review
- Measured operational failure modes and privacy impact

### Milestone D — Standards submission

- Public individual Internet-Draft for the core protocol and HTTP binding
- Community discussion with relevant IETF application and security participants
- W3C Community Group engagement for provenance and credential alignment where
  it materially improves interoperability
- Registration requests only after names, media types, and discovery semantics
  are stable

Formal standards processes use proposal and draft stages. The project website
may describe the released HACP specification without a marketing "draft" badge,
while standards submissions must accurately carry the status required by their
standards body.

## Adoption strategy

### Make Receiver enforcement easy

Receiver middleware is the highest-leverage distribution surface. HACP should
offer default-deny integrations for Fetch runtimes, Express/Fastify, FastAPI,
Cloudflare Workers, MCP servers, and common API gateways. Agents gain an adoption
incentive when useful Receivers require verifiable mandates.

### Demonstrate the missing security property

The canonical demonstration compares two ticket requests that look similar at
the HTTP layer:

- an authenticated travel Agent carrying Alice's signed, USD 600-limited
  Mandate;
- an authenticated or anonymous attacker without matching human authority.

The Receiver should expose the exact checks and signed Receipt so developers can
verify the result independently.

### Publish evidence rather than claims

Promotion should center on:

- reproducible interoperability demonstrations;
- integration case studies such as Cofeat;
- public conformance results;
- security reviews and threat-model revisions;
- concise comparisons with authentication, OAuth, MCP, A2A, and transaction
  authorization systems;
- implementation reports from maintainers outside AHI Lab.

### Build a neutral community

AHI Lab is the founding steward, not a privileged protocol participant. The
project should recruit Receiver operators, Agent developers, identity engineers,
security researchers, privacy experts, and standards editors as maintainers.
Public design meetings and decisions should be recorded in the repository.

## Success measures

The project tracks outcomes that indicate real interoperability:

- independent implementations passing conformance;
- distinct organizations verifying production actions;
- protected action types and signed Receipts processed;
- external maintainers and protocol-change authors;
- security reports resolved transparently;
- standards discussions and citations;
- percentage of integrations using organization- or user-controlled authority
  instead of a shared service attester.

Downloads, stars, impressions, and badges are useful discovery signals but are
not evidence that HACP is interoperable or secure.

## Participate

- Read the [normative HACP 0.1 specification](specification/hacp.md).
- Run the [ticket-booking interoperability demonstration](examples/ticket-booking).
- Submit an implementation report using the GitHub issue template.
- Propose protocol changes through the public change process in `GOVERNANCE.md`.
- Report vulnerabilities privately according to `SECURITY.md`.

