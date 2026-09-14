import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";
import { canonicalBytes } from "./canonicalize.js";
import { HacpError } from "./errors.js";
import type { KeyMaterial, KeyResolver, Proof, Signer } from "./types.js";

interface ProofOptions {
  type: Proof["type"];
  verificationMethod: string;
  createdAt: string;
}

function toPrivateKey(key: KeyMaterial): KeyObject {
  if (typeof key === "string") return createPrivateKey(key);
  if (key instanceof Uint8Array) {
    return createPrivateKey({ key: Buffer.from(key), format: "der", type: "pkcs8" });
  }
  return key;
}

function toPublicKey(key: KeyMaterial): KeyObject {
  if (typeof key === "string") return createPublicKey(key);
  if (key instanceof Uint8Array) {
    return createPublicKey({ key: Buffer.from(key), format: "der", type: "spki" });
  }
  return key.type === "public" ? key : createPublicKey(key);
}

function signingPayload(payload: unknown, purpose: string, options: ProofOptions): Uint8Array {
  return canonicalBytes({
    domain: "HACP-0.1",
    payload,
    proof: options,
    purpose,
  });
}

export function generateEd25519KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKey: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

export function createProof(payload: unknown, purpose: string, signer: Signer): Proof {
  const options: ProofOptions = {
    type: "Ed25519Signature2020",
    verificationMethod: signer.verificationMethod,
    createdAt: (signer.now?.() ?? new Date()).toISOString(),
  };
  const signature = nodeSign(
    null,
    signingPayload(payload, purpose, options),
    toPrivateKey(signer.privateKey),
  );
  return { ...options, proofValue: signature.toString("base64url") };
}

export async function verifyProof(
  payload: unknown,
  purpose: string,
  proof: Proof,
  resolveKey: KeyResolver,
): Promise<boolean> {
  if (proof.type !== "Ed25519Signature2020") return false;
  const options: ProofOptions = {
    type: proof.type,
    verificationMethod: proof.verificationMethod,
    createdAt: proof.createdAt,
  };
  const key = await resolveKey(proof.verificationMethod);
  try {
    return nodeVerify(
      null,
      signingPayload(payload, purpose, options),
      toPublicKey(key),
      Buffer.from(proof.proofValue, "base64url"),
    );
  } catch (error) {
    throw new HacpError("INVALID_PROOF", "The proof key or signature is invalid", {
      cause: error instanceof Error ? error.message : String(error),
      verificationMethod: proof.verificationMethod,
    });
  }
}

export function withoutProof<T extends { proof: Proof }>(value: T): Omit<T, "proof"> {
  const { proof: _proof, ...unsigned } = value;
  return unsigned;
}
