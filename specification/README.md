# HACP 0.1 specification resources

The rendered protocol specification is published at [ahi-lab.com/hacp](https://ahi-lab.com/hacp).

The repository's normative, implementation-neutral source is
[`hacp.md`](hacp.md). The website is its explanatory presentation and must not
silently define different wire or authorization semantics.

This directory contains machine-readable resources shared by every language implementation:

- [`schema/hacp.schema.json`](schema/hacp.schema.json) — JSON Schema for canonical HACP objects;
- [`../conformance/vectors`](../conformance/vectors) — canonicalization and protocol behavior fixtures.

Changes to object meaning, canonical representation, signing inputs, or verification order require:

1. an issue describing the interoperability and security impact;
2. updated machine-readable schemas;
3. positive and negative conformance vectors;
4. implementation tests;
5. compatibility review under the project governance process.

Normative requirements are expressed through uppercase requirement words.
Machine-readable artifacts define the shapes and behavior exercised by the
reference implementation and independent implementations.
