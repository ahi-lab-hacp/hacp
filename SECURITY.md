# Security policy

HACP is authorization infrastructure. Please report vulnerabilities privately and do not create a public issue containing exploit details.

## Review status

HACP has not completed an independent protocol, cryptographic, or implementation
security review. The current packages are experimental and should be evaluated
as one layer in a defense-in-depth design, not as a sole production security
boundary. See the public [review status](docs/review-status.md).

## Reporting

Use GitHub's private vulnerability reporting feature for `ahi-lab-hacp/hacp`. If that feature is unavailable, email **hello@ahi-lab.com** with the subject `HACP security report`.

Include, when possible:

- affected package and version;
- attack prerequisites and impact;
- a minimal reproduction;
- whether keys, identities, or external systems are involved;
- suggested mitigations.

Do not send real credentials, private conversations, or sensitive production data.

## Response targets

Maintainers aim to acknowledge a report within five business days, confirm severity after reproduction, and coordinate disclosure after a fix is available. Complex protocol issues may require a longer embargo to protect downstream implementations.

## Supported versions

Until a 1.0 release, only the latest published 0.x release receives security fixes. Production deployments should pin exact versions and subscribe to repository security advisories.

## Scope

Particularly important reports include signature bypass, canonicalization disagreement, identity-binding failure, delegation escalation, replay, revocation bypass, constraint confusion, and time-of-check/time-of-use vulnerabilities.

The in-memory stores and example authentication functions are development utilities, not production security controls.
