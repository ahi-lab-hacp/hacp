# Review status

Last updated: 2026-09-14

## Current status

- Protocol maturity: **experimental HACP 0.1**
- Independent implementations verified: **none**
- Independent interoperability reports: **none**
- Independent security audits completed: **none**
- Production certification: **none**

Repository CI, project-maintained conformance vectors, the ticket demonstration,
and the Cofeat integration provide implementation evidence. They are not an
independent security assessment or certification.

## Feedback sought

The project welcomes independent review of:

- canonicalization and signature construction;
- identity and verification-method authorization;
- delegation attenuation and authority resolution;
- intent and constraint evaluation;
- nonce, expiry, revocation, and key lifecycle behavior;
- HTTP binding and parser differentials;
- time-of-check/time-of-use boundaries;
- privacy and evidence-disclosure risks; and
- ambiguity that could cause cross-language interoperability failures.

Reviewers may submit non-sensitive findings through the public review-feedback
issue template or join the open
[independent implementation and security review request](https://github.com/ahi-lab-hacp/hacp/issues/1).
Potential vulnerabilities or exploit details must use GitHub private vulnerability
reporting or the contact in [SECURITY.md](../SECURITY.md).

## Exit criteria for a stable release

HACP will not claim stable or production-certified status solely because its
reference packages reach a particular version. Stability requires multiple
independent interoperable implementations, expanded conformance coverage,
documented operational pilots, resolved high-severity review findings, and a
published compatibility policy.
