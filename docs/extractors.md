# Implementing a Decision extractor

HACP deliberately does not bundle an LLM or prescribe a model provider. Applications implement `DecisionExtractor` and pass it to `extractDecision()`.

```ts
import type { DecisionExtractor } from "@ahi-lab-hacp/core";

export const extractor: DecisionExtractor = {
  async extract({ communication, evidence }) {
    const output = await yourStructuredModelCall(communication);
    return {
      intent: output.intent,
      constraints: output.constraints,
      fieldSources: output.fields.map((field) => ({
        path: field.jsonPointer,
        basis: field.directQuote ? "ASSERTED" : "INFERRED",
        evidenceDigest: evidence.digest,
        confidence: field.confidence,
      })),
    };
  },
};
```

## Requirements

- Preserve an immutable digest of every source used.
- Identify each consequential field as `ASSERTED` or `INFERRED`.
- Do not translate an inferred preference into broader authorization.
- Use a typed, domain-defined intent vocabulary.
- Keep human-readable statements alongside machine-evaluable fields.
- Present the complete canonical Decision for review before direct attestation.
- Create a new Decision when an attested material field changes.

The extractor is untrusted input to the authorization process. Attestation—not model confidence—creates authority.
