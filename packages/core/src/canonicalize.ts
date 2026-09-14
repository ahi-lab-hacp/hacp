import { createHash } from "node:crypto";
import { HacpError } from "./errors.js";

/**
 * Serializes a JSON value deterministically using the ordering and primitive
 * representation required by the HACP 0.1 canonical JSON profile.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new HacpError("MALFORMED_ENVELOPE", "Non-finite numbers are not valid JSON");
      }
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalize(item)).join(",")}]`;
      }

      const object = value as Record<string, unknown>;
      const members = Object.keys(object)
        .sort()
        .map((key) => {
          const member = object[key];
          if (member === undefined) {
            throw new HacpError(
              "MALFORMED_ENVELOPE",
              `Undefined member is not valid canonical JSON: ${key}`,
            );
          }
          return `${JSON.stringify(key)}:${canonicalize(member)}`;
        });
      return `{${members.join(",")}}`;
    }
    default:
      throw new HacpError(
        "MALFORMED_ENVELOPE",
        `Unsupported canonical JSON value: ${typeof value}`,
      );
  }
}

export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function digestObject(value: unknown): string {
  return `sha256:${sha256(canonicalBytes(value))}`;
}
