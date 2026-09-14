# Language support

HACP is a wire protocol, not a TypeScript-only API. An implementation is compatible when it produces the same canonical bytes, verifies the same proof chain, and returns the same authorization result for the published conformance vectors.

## Official implementation order

1. **TypeScript/JavaScript** is the HACP 0.1 reference SDK. It covers agent runtimes, Fetch-compatible servers, browser tooling, and the command line.
2. **Python** is planned next because it is widely used for agent orchestration, model integration, and policy services.
3. **Go** is planned for reverse proxies, API gateways, admission controllers, and other infrastructure-side verifiers.
4. **Java** becomes appropriate once enterprise adopters require JVM-native middleware.
5. **Rust** should be added when a concrete high-assurance, native, WebAssembly, or embedded verifier use case exists.

An SDK must not be marked conformant solely because its object types resemble the TypeScript types. It must pass the language-neutral vectors under [`../conformance/vectors`](../conformance/vectors) and implement the verification order defined by the protocol.

## What remains language-neutral

- JSON object definitions and required fields
- canonical serialization and digests
- proof purposes and signature input bytes
- identity-to-verification-method binding
- delegation attenuation rules
- audience, validity, revocation, replay, scope, constraint, and policy checks
- `ALLOW`, `DENY`, and `REVIEW` receipt semantics
- HTTP media type and headers

Language SDKs may use idiomatic APIs, but they must not change these wire-level semantics.
