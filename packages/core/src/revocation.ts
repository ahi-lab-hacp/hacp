import { randomUUID } from "node:crypto";
import { createProof, createProofWithProvider, verifyProof, withoutProof } from "./crypto.js";
import { HacpError } from "./errors.js";
import { verificationContext } from "./keys.js";
import {
  HACP_VERSION,
  type KeyResolver,
  type RevocationRecord,
  type RevocationResolver,
  type Signer,
  type SigningProvider,
  type VerificationMethodAuthorizer,
} from "./types.js";

export interface CreateRevocationOptions {
  effectiveAt?: string;
  id?: string;
  issuer: string;
  objectRef: string;
  reason: string;
  signer: Signer;
}

export interface CreateRevocationWithProviderOptions
  extends Omit<CreateRevocationOptions, "signer"> {
  signer: SigningProvider;
}

function createUnsignedRevocation(
  options: Omit<CreateRevocationOptions, "signer">,
  now: Date,
): Omit<RevocationRecord, "proof"> {
  return {
    hacpVersion: HACP_VERSION,
    type: "revocation",
    id: options.id ?? `rev_${randomUUID()}`,
    issuer: options.issuer,
    objectRef: options.objectRef,
    reason: options.reason,
    effectiveAt: options.effectiveAt ?? now.toISOString(),
    createdAt: now.toISOString(),
  };
}

export function createRevocation(options: CreateRevocationOptions): RevocationRecord {
  const now = options.signer.now?.() ?? new Date();
  const unsigned = createUnsignedRevocation(options, now);
  return { ...unsigned, proof: createProof(unsigned, "hacp:revocation", options.signer) };
}

export async function createRevocationWithProvider(
  options: CreateRevocationWithProviderOptions,
): Promise<RevocationRecord> {
  const unsigned = createUnsignedRevocation(options, options.signer.now?.() ?? new Date());
  return {
    ...unsigned,
    proof: await createProofWithProvider(unsigned, "hacp:revocation", options.signer),
  };
}

export function revocationPayload(revocation: RevocationRecord): Omit<RevocationRecord, "proof"> {
  return withoutProof(revocation);
}

export interface VerifyRevocationRecordOptions {
  authorizeIssuer(objectRef: string, issuer: string): boolean | Promise<boolean>;
  authorizeVerificationMethod: VerificationMethodAuthorizer;
  resolveKey: KeyResolver;
  verificationTime?: Date;
}

export async function verifyRevocationRecord(
  revocation: RevocationRecord,
  options: VerifyRevocationRecordOptions,
): Promise<boolean> {
  if (revocation.hacpVersion !== HACP_VERSION || revocation.type !== "revocation") return false;
  if (!Number.isFinite(Date.parse(revocation.createdAt))) return false;
  if (!Number.isFinite(Date.parse(revocation.effectiveAt))) return false;
  if (
    !(await verifyProof(
      revocationPayload(revocation),
      "hacp:revocation",
      revocation.proof,
      options.resolveKey,
    ))
  ) {
    return false;
  }
  if (
    !(await options.authorizeVerificationMethod(
      revocation.issuer,
      revocation.proof.verificationMethod,
      verificationContext(
        "hacp:revocation",
        revocation.proof.createdAt,
        options.verificationTime ?? new Date(),
      ),
    ))
  ) {
    return false;
  }
  return options.authorizeIssuer(revocation.objectRef, revocation.issuer);
}

export interface VerifiedRevocationResolverOptions extends VerifyRevocationRecordOptions {
  resolveRecords(objectRef: string): RevocationRecord[] | Promise<RevocationRecord[]>;
  strict?: boolean;
}

/** Validates signatures and issuer authority before trusting revocation state. */
export class VerifiedRevocationResolver implements RevocationResolver {
  readonly #options: VerifiedRevocationResolverOptions;

  constructor(options: VerifiedRevocationResolverOptions) {
    this.#options = options;
  }

  async isRevoked(objectRef: string, at: Date): Promise<boolean> {
    const records = await this.#options.resolveRecords(objectRef);
    for (const record of records) {
      if (record.objectRef !== objectRef) {
        if (this.#options.strict !== false) {
          throw new HacpError("INVALID_REVOCATION", "Revocation object reference mismatch");
        }
        continue;
      }
      const valid = await verifyRevocationRecord(record, {
        ...this.#options,
        verificationTime: at,
      });
      if (!valid) {
        if (this.#options.strict !== false) {
          throw new HacpError("INVALID_REVOCATION", "Revocation proof or issuer is invalid");
        }
        continue;
      }
      if (Date.parse(record.effectiveAt) <= at.getTime()) return true;
    }
    return false;
  }
}
