# Contributing to HACP

Thank you for helping make human–agent coordination accountable and interoperable.

## Before opening a pull request

1. Search existing issues and discussions.
2. Open an issue first for protocol semantics, public API changes, or new dependencies.
3. Keep changes focused and add positive and negative tests.
4. Run `pnpm check` locally.
5. Add a changeset for changes affecting published packages.

## Development setup

```bash
corepack enable
pnpm install
pnpm check
```

The complete example runs with:

```bash
pnpm --filter @hacp-example/basic start
```

## Protocol changes

A protocol change includes anything that affects canonical bytes, object meaning, signing inputs, delegation attenuation, verification order, or verdict semantics. Such changes must include:

- a written compatibility and security analysis;
- updated JSON Schema;
- cross-language conformance vectors;
- positive and negative implementation tests;
- documentation for migration or version negotiation.

Protocol changes are reviewed more conservatively than implementation changes. Breaking authorization semantics require a new protocol major version.

## Security-sensitive code

Cryptographic, canonicalization, identity-binding, nonce, revocation, constraint, and effect-boundary changes require review by two maintainers when the project has enough active maintainers. Avoid clever code in these paths; explicit checks and auditable control flow are preferred.

## Pull request expectations

- Use clear commit messages and explain why the change is necessary.
- Preserve strict TypeScript settings.
- Do not add provider-specific behavior to the transport-neutral core.
- Never weaken a fail-closed condition for convenience.
- Do not include secrets, production keys, personal data, or raw private conversations in tests.
- Update the README or relevant guide when public behavior changes.

By contributing, you agree that your contributions are licensed under Apache-2.0 and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
