import { HacpError } from "./errors.js";
import type { NonceStore } from "./types.js";

export interface AtomicNoncePersistence {
  consumeIfAbsent(input: {
    expiresAt: Date;
    nonce: string;
    scope: string;
  }): boolean | Promise<boolean>;
}

/**
 * Production nonce adapter backed by a deployment-provided atomic insert.
 * The backend must enforce uniqueness for the pair `(scope, nonce)`.
 */
export class DurableNonceStore implements NonceStore {
  readonly #persistence: AtomicNoncePersistence;

  constructor(persistence: AtomicNoncePersistence) {
    this.#persistence = persistence;
  }

  async consume(scope: string, nonce: string, expiresAt: Date): Promise<boolean> {
    if (!scope || !nonce || !Number.isFinite(expiresAt.getTime())) {
      throw new HacpError("REPLAY_DETECTED", "Nonce scope, value, and expiry must be valid");
    }
    return this.#persistence.consumeIfAbsent({ scope, nonce, expiresAt });
  }
}
