# Human–Agent Coordination Protocol (HACP) 0.1

## Status

This document defines the HACP 0.1 open protocol specification. It is maintained
in public with the reference implementation and conformance artifacts. HACP 0.1
is not an IETF RFC, W3C Recommendation, or specification endorsed by another
standards-development organization.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** are to be interpreted as described by BCP 14 when, and only when,
they appear in all capitals.

## 1. Abstract

HACP carries verifiable human or institutional authority with an agent action.
It defines a chain of signed objects connecting a reviewed Decision to a bounded
Mandate, a concrete Action Envelope, and a receiver-issued Receipt.

HACP complements authentication and transport security. Authentication proves
which workload is calling. HACP lets the receiver determine which authority
stands behind the specific action, what limits apply, and whether the proposed
effect remains inside those limits.

## 2. Scope

HACP 0.1 specifies:

- a common object model for Decisions, Mandates, Action Envelopes, Receipts, and
  revocations;
- deterministic signing inputs and an Ed25519 proof profile;
- delegation attenuation and receiver verification rules;
- a Fetch-compatible HTTP binding;
- public receiver discovery;
- conformance requirements and language-neutral test vectors.

HACP does not specify natural-language model selection, universal identity,
transport authentication, key custody, organizational trust policy, or whether
an authorized action is ethically desirable. Those decisions remain with the
deploying parties and receiver.

## 3. Roles

| Role | Responsibility |
| --- | --- |
| Principal | Human or institution whose decision is represented |
| Attester | Party whose accepted key signs the reviewed Decision |
| Mandate issuer | Party delegating bounded authority to an Agent |
| Agent | Authenticated workload proposing the external action |
| Receiver | Service controlling the requested external effect |
| Verifier | Receiver component evaluating the complete HACP chain |
| Auditor | Party validating retained objects and signed Receipts later |

A deployment MAY combine roles, but it MUST preserve the verification rules and
MUST identify which role controlled each signing key.

## 4. Trust model

### 4.1 Separation from authentication

The Receiver MUST authenticate the calling workload independently of the HACP
body. It MUST NOT derive `authenticatedAgent` from `ActionEnvelope.agent` or any
other caller-controlled field. The authenticated identity MUST equal the Agent
named in the Action Envelope and leaf Mandate.

### 4.2 Extraction is not authorization

Natural-language extraction produces a `PROPOSED` Decision. A proposed Decision
MUST NOT authorize a consequential action. Authority begins only after an
accepted attester signs the exact canonical Decision and changes its state to
`ATTESTED`.

### 4.3 Trust policy

A valid signature proves possession of a key; it does not prove that the key is
authorized for an identity. The Receiver MUST apply local trust policy to every
verification method. A witnessed approval is valid only when the Receiver
accepts the witness or organization as an attester for the named Principal.

Verification-method authorization MUST consider the proof creation time and
the key lifecycle. Retired public keys SHOULD remain resolvable for historical
proofs created while active. A key revoked as compromised MUST fail current
authorization according to Receiver policy even when its cryptographic
signature remains mathematically valid.

### 4.4 Receiver sovereignty

Passing HACP verification does not require the Receiver to execute an action.
The Receiver's local policy produces the final `ALLOW`, `DENY`, or `REVIEW`
verdict. An external effect MUST occur only after `ALLOW`.

## 5. Common representation

All HACP objects are UTF-8 JSON objects. They contain:

- `hacpVersion`, equal to `"0.1"`;
- a globally unique `id`;
- a protocol object `type`;
- object-specific fields;
- a proof or attestation when the object carries authority.

Unknown fields MUST NOT change the meaning of a known field. A verifier that
cannot safely interpret an extension affecting authorization MUST return
`REVIEW` or `DENY`.

### 5.1 Principal

A Principal contains an `id`, a `type` of `HUMAN` or `INSTITUTION`, and an
optional organization identifier. Identifiers are URIs. HACP does not require a
particular URI or decentralized-identifier method.

### 5.2 Decision

A Decision contains:

- lifecycle `state`;
- `principal`;
- typed `intent` with a human-readable statement;
- machine-evaluable `constraints`;
- evidence commitments;
- field-level sources marked `ASSERTED` or `INFERRED`;
- creation time;
- optional superseded Decision identifiers;
- an attestation when the state is `ATTESTED`.

The intent `type` identifies the authorized action type. Intent `parameters`
are exact, machine-evaluable assertions about the requested effect. Values that
represent ranges, maxima, sets, or other policy semantics belong in
`constraints`.

The attestation covers every Decision field except the attestation itself.

### 5.3 Mandate

A Mandate identifies its issuer and Agent subject, references one Decision,
lists permissions, carries constraints and audiences, defines a validity
interval, limits further delegation, and includes a nonce and proof.

A root Mandate issuer MUST be the Decision Principal or its organization under
the Receiver's accepted identity policy. A delegated Mandate issuer MUST equal
the parent Mandate subject.

Every root Mandate permission MUST equal the controlling Decision intent type.
A Mandate MUST NOT translate a Decision into a different action type.

Every child Mandate MUST monotonically narrow or preserve:

- permissions;
- audiences;
- expiration;
- constraints;
- remaining delegation depth.

A child MUST NOT add authority absent from its parent.

### 5.4 Action Envelope

An Action Envelope identifies one Mandate, the acting Agent, a one-time nonce,
creation time, and the exact action. The action contains a type, target URI, and
JSON parameters. Its proof binds all these fields.

### 5.5 Receipt

A Receipt records the Verifier, verdict, action digest, Mandate reference,
reason codes, policy version, evaluation time, and proof. A Receipt is evidence
of a verification result, not evidence that an external effect completed.
Applications SHOULD retain an effect record atomically with, or directly linked
to, an `ALLOW` Receipt.

### 5.6 Revocation record

A revocation identifies its issuer, target object, reason, effective time,
creation time, and proof. Revocation affects future authorization decisions.
Historical audit MUST evaluate authority against the time and policy relevant to
the event being audited.

A Receiver MUST verify the Revocation proof, authorize its verification method
for the named issuer, and determine that the issuer is permitted to revoke the
referenced object. Merely finding an object identifier in an unverified
revocation list is insufficient.

## 6. Evidence and privacy

Evidence references contain a digest, media type, disclosure mode, and optional
source. Implementations SHOULD commit to the minimum evidence necessary and
SHOULD use `DIGEST_ONLY` when full communication disclosure is unnecessary.

Evidence digests prove equality to later-disclosed material. They do not prove
truth, authorship, completeness, or lawful collection. Deployments MUST apply
their own retention, access-control, and privacy requirements.

## 7. Proof profile

### 7.1 HACP 0.1 Ed25519 profile

The reference proof has these members:

- `type`: `Ed25519Signature2020`;
- `verificationMethod`: URI identifying the verification key;
- `createdAt`: RFC 3339 timestamp;
- `proofValue`: unpadded base64url Ed25519 signature.

The `Ed25519Signature2020` value is retained as the HACP 0.1 compatibility
identifier. HACP 0.1 does not claim that its signing transformation implements
the W3C Data Integrity cryptosuite of a similar name.

### 7.2 Signing input

The signer constructs the following object:

```json
{
  "domain": "HACP-0.1",
  "payload": {},
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "https://example.test/keys/1",
    "createdAt": "2026-09-14T00:00:00.000Z"
  },
  "purpose": "hacp:action"
}
```

The object is serialized using the HACP 0.1 canonical JSON profile and signed
with Ed25519. Purpose values are:

| Object | Purpose |
| --- | --- |
| Decision attestation | `hacp:decision-attestation` |
| Mandate | `hacp:mandate` |
| Action Envelope | `hacp:action` |
| Receipt | `hacp:receipt` |
| Revocation | `hacp:revocation` |

### 7.3 Canonical JSON

The HACP 0.1 canonicalizer:

1. serializes `null`, booleans, finite JSON numbers, and strings using JSON
   primitive representation;
2. preserves array order;
3. orders object member names lexicographically;
4. omits insignificant whitespace;
5. rejects non-finite numbers, `undefined`, and non-JSON values.

Implementations MUST reproduce the bytes in `conformance/vectors`. HACP 0.2
will evaluate direct adoption of RFC 8785 JSON Canonicalization Scheme so this
profile can rely on an established cross-language specification.

## 8. Verification algorithm

For a consequential action, the Verifier MUST perform the following checks
before the external effect:

1. Confirm supported HACP version and object type.
2. Validate Action Envelope time syntax.
3. Resolve the Agent verification key and verify the Action Envelope proof.
4. Authorize that verification method for the named Agent.
5. Compare the independently authenticated Agent identity.
6. Resolve the complete Mandate chain and reject cycles or excessive depth.
7. Resolve and verify the controlling attested Decision.
8. Authorize the Decision verification method for the Principal or accepted
   organization/attester.
9. Verify every Mandate proof and issuer.
10. Verify delegation continuity and monotonic attenuation.
11. Verify leaf subject, permission, audience, validity, and revocation status.
12. Verify that the action type and machine-readable parameters match the
    controlling Decision intent.
13. Evaluate the concrete action against all known constraints.
14. Atomically consume the Action Envelope nonce.
15. Apply receiver-local policy.
16. Return a signed Receipt.

Missing objects, unknown keys, unknown security-relevant intent semantics or
constraints, failed proofs, ambiguous identities, and unavailable revocation
state MUST fail closed to `REVIEW` or `DENY` according to receiver policy.

## 9. Assurance

HACP 0.1 defines four labels:

| Level | Meaning |
| --- | --- |
| `HACP_L0` | Declared provenance without accepted authority; non-consequential use only |
| `HACP_L1` | Authenticated Agent attestation plus evidence commitment |
| `HACP_L2` | Principal or organization signature over the exact Decision |
| `HACP_L3` | Approval witnessed or logged by an independently trusted authority |

The label alone MUST NOT cause acceptance. The Receiver MUST verify that the
attestation method, signer, evidence, and local trust policy satisfy the claimed
level. A service signing for all its users without separate authority MUST NOT
represent that event as a personal user signature.

## 10. HTTP binding

The HTTP binding sends one Action Envelope as an
`application/hacp+json` request body and includes `HACP-Version: 0.1`.

The Receiver authenticates the caller using OAuth, mTLS, workload identity, or
another mechanism outside HACP. The effective request origin MUST be determined
from trusted server configuration, not untrusted forwarding headers.

Receipt responses use `application/hacp+json`. A Receiver may place a Receipt in
its business response after an allowed effect, provided the Receipt remains
unmodified and independently verifiable.

## 11. Public discovery

A Receiver SHOULD publish `/.well-known/hacp.json` with:

- `hacpVersion`;
- issuer, Verifier, and audience identifiers;
- supported algorithms;
- public verification methods;
- optionally, accepted actions and assurance levels.

Discovery MUST contain only public key material. Discovery does not establish
trust by itself; verifiers and clients MUST authenticate the origin and apply
their configured issuer and key policies.

## 12. Security considerations

Deployments MUST:

- protect private keys with managed key storage appropriate to the risk;
- keep human and institutional authority keys outside the Agent and model
  runtime, using a narrowly scoped signing boundary;
- separate authority, Agent, and Receipt signing keys when roles differ;
- authenticate Agents independently of HACP bodies;
- validate proof-to-identity authorization, not signatures alone;
- prevent direct Agent access to protected effects when a gateway enforces HACP;
- consume nonces atomically across receiver instances;
- enforce expiry, revocation, audience, and target binding;
- preserve denial behavior when dependencies fail;
- rate-limit public endpoints and retain security-relevant verification events;
- rotate keys with stable verification-method identifiers and historical lookup.

The non-normative [production deployment boundary](../docs/production-deployment.md)
describes isolated approval, signing-provider, durable nonce, key-lifecycle, and
effect-transaction integrations.

HACP cannot prevent a properly authorized malicious human from requesting a
harmful action, guarantee that evidence is truthful, or replace fraud detection,
bot management, application authorization, transport security, and domain
policy.

## 13. Conformance

A conforming implementation declares one or more roles:

- Core object producer;
- Agent signer;
- HTTP sender;
- Receiver verifier;
- Receipt verifier;
- object resolver.

It MUST pass all applicable positive and negative test vectors, produce the same
canonical bytes and digests, and return the required authorization outcome for
normative verification cases. Merely exposing matching JSON fields is not
conformance.

Independent implementation reports are recorded in `IMPLEMENTERS.md` only after
the maintainer supplies a reproducible version and applicable conformance
results.

## 14. Versioning and evolution

Package versions and protocol versions are independent. A change to object
meaning, signing input, canonicalization, or required verification behavior
requires protocol compatibility review. Receivers MUST reject unsupported major
versions and MUST NOT silently reinterpret an older signed object under newer
semantics.

HACP 0.2 work will prioritize established cryptographic envelopes, cross-language
interoperability, resolver security, assurance semantics, and independent
implementations. HACP 1.0 requires demonstrated interoperability and external
security review.

## 15. References

- [BCP 14 requirement language](https://www.rfc-editor.org/info/bcp14)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [RFC 9421: HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421)
- [RFC 7515: JSON Web Signature](https://www.rfc-editor.org/rfc/rfc7515)
- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [W3C Verifiable Credential Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/)
