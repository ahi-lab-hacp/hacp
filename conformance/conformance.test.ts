import { readFile } from "node:fs/promises";
import { canonicalize, type JsonValue } from "@ahi-lab-hacp/core";
import { describe, expect, it } from "vitest";

interface CanonicalizationVector {
  name: string;
  input: JsonValue;
  canonical: string;
}

const vectors = JSON.parse(
  await readFile(new URL("./vectors/canonicalization.json", import.meta.url), "utf8"),
) as CanonicalizationVector[];

describe("published conformance vectors", () => {
  for (const vector of vectors) {
    it(vector.name, () => {
      expect(canonicalize(vector.input)).toBe(vector.canonical);
    });
  }
});
