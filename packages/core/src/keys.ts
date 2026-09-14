import type {
  KeyMaterial,
  KeyResolver,
  VerificationMethodAuthorizationContext,
  VerificationMethodAuthorizer,
} from "./types.js";

export interface VerificationMethodRecord {
  activatedAt: string;
  controller: string;
  id: string;
  publicKey: KeyMaterial;
  retiredAt?: string;
  revokedAt?: string;
}

export type VerificationMethodRecordResolver = (
  id: string,
) => VerificationMethodRecord | Promise<VerificationMethodRecord>;

/**
 * Keeps retired public keys resolvable for historical proofs while rejecting
 * proofs created outside their active interval and keys revoked as compromised.
 */
export class VerificationMethodRegistry {
  readonly #resolveRecord: VerificationMethodRecordResolver;

  constructor(resolveRecord: VerificationMethodRecordResolver) {
    this.#resolveRecord = resolveRecord;
  }

  resolveKey: KeyResolver = async (verificationMethod) =>
    (await this.#resolveRecord(verificationMethod)).publicKey;

  authorizeVerificationMethod: VerificationMethodAuthorizer = async (
    identity,
    verificationMethod,
    context,
  ) => {
    const record = await this.#resolveRecord(verificationMethod);
    if (record.id !== verificationMethod || record.controller !== identity) return false;

    const proofTime = Date.parse(context?.proofCreatedAt ?? "");
    const verificationTime = context?.verificationTime.getTime() ?? Date.now();
    const activatedAt = Date.parse(record.activatedAt);
    if (
      !Number.isFinite(proofTime) ||
      !Number.isFinite(verificationTime) ||
      !Number.isFinite(activatedAt) ||
      proofTime < activatedAt
    ) {
      return false;
    }
    if (record.retiredAt) {
      const retiredAt = Date.parse(record.retiredAt);
      if (!Number.isFinite(retiredAt) || proofTime >= retiredAt) return false;
    }
    if (record.revokedAt) {
      const revokedAt = Date.parse(record.revokedAt);
      if (!Number.isFinite(revokedAt) || verificationTime >= revokedAt) return false;
    }
    return true;
  };
}

export function verificationContext(
  purpose: string,
  proofCreatedAt: string,
  verificationTime: Date,
): VerificationMethodAuthorizationContext {
  return { proofCreatedAt, purpose, verificationTime };
}
