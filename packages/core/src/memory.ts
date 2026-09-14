import type {
  Decision,
  KeyMaterial,
  Mandate,
  NonceStore,
  Receipt,
  RevocationRecord,
  RevocationResolver,
} from "./types.js";
import { HacpError } from "./errors.js";

export class InMemoryNonceStore implements NonceStore {
  readonly #entries = new Map<string, number>();
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  consume(scope: string, nonce: string, expiresAt: Date): boolean {
    const now = this.#now().getTime();
    for (const [key, expiry] of this.#entries) {
      if (expiry <= now) this.#entries.delete(key);
    }
    const key = `${scope}|${nonce}`;
    if (this.#entries.has(key)) return false;
    this.#entries.set(key, expiresAt.getTime());
    return true;
  }
}

export class InMemoryHacpStore implements RevocationResolver {
  readonly decisions = new Map<string, Decision>();
  readonly mandates = new Map<string, Mandate>();
  readonly receipts = new Map<string, Receipt>();
  readonly revocations = new Map<string, RevocationRecord[]>();
  readonly keys = new Map<string, KeyMaterial>();

  putDecision(decision: Decision): void {
    this.decisions.set(decision.id, decision);
  }

  putMandate(mandate: Mandate): void {
    this.mandates.set(mandate.id, mandate);
  }

  putReceipt(receipt: Receipt): void {
    this.receipts.set(receipt.id, receipt);
  }

  putRevocation(revocation: RevocationRecord): void {
    const records = this.revocations.get(revocation.objectRef) ?? [];
    records.push(revocation);
    this.revocations.set(revocation.objectRef, records);
  }

  putKey(verificationMethod: string, key: KeyMaterial): void {
    this.keys.set(verificationMethod, key);
  }

  resolveDecision = (id: string): Decision => {
    const value = this.decisions.get(id);
    if (!value) throw new HacpError("OBJECT_NOT_FOUND", `Decision not found: ${id}`);
    return value;
  };

  resolveMandate = (id: string): Mandate => {
    const value = this.mandates.get(id);
    if (!value) throw new HacpError("OBJECT_NOT_FOUND", `Mandate not found: ${id}`);
    return value;
  };

  resolveKey = (verificationMethod: string): KeyMaterial => {
    const value = this.keys.get(verificationMethod);
    if (!value) {
      throw new HacpError("INVALID_PROOF", `Verification method not found: ${verificationMethod}`);
    }
    return value;
  };

  isRevoked(objectRef: string, at: Date): boolean {
    return (this.revocations.get(objectRef) ?? []).some(
      (record) => Date.parse(record.effectiveAt) <= at.getTime(),
    );
  }
}
