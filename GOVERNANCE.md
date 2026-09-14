# Governance

HACP is an open protocol stewarded by the `ahi-lab-hacp` GitHub organization. AHI.lab is the founding steward; protocol participation is open to independent implementers, security researchers, service operators, and agent developers.

## Decision principles

Protocol decisions prioritize, in order:

1. preserving explicit human or institutional authority;
2. preventing silent authority expansion;
3. enabling independent receiver verification;
4. minimizing disclosure of private communication;
5. maintaining cross-language interoperability;
6. keeping integrations practical.

## Change process

Small implementation fixes use normal pull-request review. Material protocol changes begin as a public design issue and include motivation, security impact, wire changes, compatibility, and alternatives. Maintainers seek rough consensus and document unresolved objections.

Canonicalization, proof construction, authorization meaning, and verification-order changes require two maintainer approvals when two eligible maintainers are available. A founding maintainer may make the decision when the project has only one active maintainer, but must publish the rationale.

## Roles

- **Contributors** participate through issues, reviews, implementations, and documentation.
- **Maintainers** merge changes, triage reports, and safeguard compatibility and security requirements.
- **Protocol editors** maintain normative language, schemas, and conformance artifacts.
- **Security maintainers** coordinate private reports and releases.

Roles are earned through sustained, constructive contributions. Maintainers may nominate new maintainers in a public governance issue.

## Releases

Published packages use semantic versioning. The protocol version is separate from package versions. A package patch may fix implementation behavior without changing HACP 0.1; an authorization-semantic change may require HACP 1.0 even if package APIs remain source-compatible.

## Independence

No implementation, model provider, identity system, or commercial service is privileged by the core protocol. Receiver-local trust policy remains a fundamental design requirement.
