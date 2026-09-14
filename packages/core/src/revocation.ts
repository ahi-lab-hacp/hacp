import { randomUUID } from "node:crypto";
import { createProof, withoutProof } from "./crypto.js";
import { HACP_VERSION, type RevocationRecord, type Signer } from "./types.js";

export interface CreateRevocationOptions {
  effectiveAt?: string;
  id?: string;
  issuer: string;
  objectRef: string;
  reason: string;
  signer: Signer;
}

export function createRevocation(options: CreateRevocationOptions): RevocationRecord {
  const now = options.signer.now?.() ?? new Date();
  const unsigned: Omit<RevocationRecord, "proof"> = {
    hacpVersion: HACP_VERSION,
    type: "revocation",
    id: options.id ?? `rev_${randomUUID()}`,
    issuer: options.issuer,
    objectRef: options.objectRef,
    reason: options.reason,
    effectiveAt: options.effectiveAt ?? now.toISOString(),
    createdAt: now.toISOString(),
  };
  return { ...unsigned, proof: createProof(unsigned, "hacp:revocation", options.signer) };
}

export function revocationPayload(revocation: RevocationRecord): Omit<RevocationRecord, "proof"> {
  return withoutProof(revocation);
}
