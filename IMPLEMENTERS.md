# HACP implementation registry

This registry distinguishes project-maintained references from independent
implementations. Inclusion records an implementation report; it is not a
security certification or endorsement.

## Project-maintained references

| Implementation | Roles | Language | Conformance | Maintainer |
| --- | --- | --- | --- | --- |
| `@ahi-lab-hacp/core` | Object producer, Agent signer, Receiver verifier, Receipt verifier | TypeScript | Repository CI | AHI Lab |
| `@ahi-lab-hacp/http` | HTTP sender, Fetch Receiver boundary, discovery | TypeScript | Repository CI | AHI Lab |
| Ticket-booking demo | Principal, Agent, Receiver, audit artifact | TypeScript | Repository CI | AHI Lab |
| Cofeat integration | Witnessed authority, Slack Agent, API Receiver | TypeScript | Cofeat CI | Cofeat / AHI Lab |

## Independent implementations

No independent implementation has been verified yet.

Experimental implementers are encouraged to start in observation mode, report
ambiguous or non-interoperable behavior, and avoid claiming security
certification. See the [adoption guide](docs/adoption.md) and current
[review status](docs/review-status.md).

To add one, submit an implementation report containing:

- repository and released version;
- maintaining organization or individuals;
- implemented HACP roles and bindings;
- language and runtime;
- applicable conformance-vector results;
- known deviations or unsupported features;
- a stable contact for interoperability and security coordination.

An implementation is independent when its protocol-critical code is maintained
outside the `ahi-lab-hacp` organization and is not a repackaging of the
TypeScript reference implementation.

Design reviewers who are not yet implementing HACP can submit public feedback
using the review-feedback issue template. Potential vulnerabilities must be
reported privately according to [SECURITY.md](SECURITY.md).
