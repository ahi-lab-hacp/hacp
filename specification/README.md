# HACP 0.1 specification resources

The rendered protocol specification is published at [ahi-lab.com/hacp](https://ahi-lab.com/hacp).

This directory contains machine-readable resources shared by every language implementation:

- [`schema/hacp.schema.json`](schema/hacp.schema.json) — JSON Schema for canonical HACP objects;
- [`../conformance/vectors`](../conformance/vectors) — canonicalization and protocol behavior fixtures.

Changes to object meaning, canonical representation, signing inputs, or verification order require:

1. an issue describing the interoperability and security impact;
2. updated machine-readable schemas;
3. positive and negative conformance vectors;
4. implementation tests;
5. compatibility review under the project governance process.

The website is explanatory and normative requirements are expressed through uppercase requirement words. Machine-readable artifacts in this repository define the shapes exercised by the reference implementation.
