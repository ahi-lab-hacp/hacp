import { createPrivateKey, sign as nodeSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  attestApprovedDecisionWithProvider,
  attestDecisionWithProvider,
  createActionEnvelopeWithProvider,
  createRevocationWithProvider,
  DurableNonceStore,
  decisionDigest,
  extractDecision,
  generateEd25519KeyPair,
  InMemoryHacpStore,
  InMemoryNonceStore,
  issueMandateWithProvider,
  type SigningProvider,
  VerificationMethodRegistry,
  VerifiedRevocationResolver,
  verifyAction,
} from "./index.js";

const now = new Date("2026-09-14T12:00:00.000Z");

function isolatedProvider(verificationMethod: string) {
  const keys = generateEd25519KeyPair();
  const privateKey = createPrivateKey(keys.privateKey);
  const provider: SigningProvider = {
    verificationMethod,
    now: () => now,
    sign: async (bytes) => nodeSign(null, bytes, privateKey),
  };
  return { provider, publicKey: keys.publicKey };
}

describe("isolated signing boundary", () => {
  it("requires a one-time approval bound to the exact proposed Decision", async () => {
    const human = "did:web:example.test:users:alice";
    const signing = isolatedProvider(`${human}#authority-1`);
    const proposal = await extractDecision({
      communication: "Book one ticket.",
      principal: { id: human, type: "HUMAN" },
      extractor: {
        extract: ({ evidence }) => ({
          intent: { type: "flight.purchase", statement: "Book one ticket." },
          constraints: { maxQuantity: 1 },
          fieldSources: [{ path: "/intent", basis: "ASSERTED", evidenceDigest: evidence.digest }],
        }),
      },
      now: () => now,
    });
    let consumed = false;
    const approvedDigest = decisionDigest(proposal);
    const approvals = {
      consume: (_id: string, expectedDigest: string) => {
        if (consumed) throw new Error("Approval already consumed");
        if (expectedDigest !== approvedDigest) throw new Error("Decision digest mismatch");
        consumed = true;
        return {
          id: "approval-1",
          principal: human,
          decisionDigest: approvedDigest,
          authenticationMethod: "PASSKEY",
          approvedAt: "2026-09-14T11:59:00.000Z",
          expiresAt: "2026-09-14T12:05:00.000Z",
        };
      },
    };
    const decision = await attestApprovedDecisionWithProvider({
      approvalId: "approval-1",
      approvals,
      decision: proposal,
      signer: signing.provider,
      now: () => now,
    });
    expect(decision.state).toBe("ATTESTED");
    expect(approvedDigest).toBeTruthy();
    await expect(
      attestApprovedDecisionWithProvider({
        approvalId: "approval-1",
        approvals,
        decision: proposal,
        signer: signing.provider,
        now: () => now,
      }),
    ).rejects.toThrow("Approval already consumed");
  });

  it("creates and verifies the full chain without exposing private keys to HACP", async () => {
    const human = "did:web:example.test:users:alice";
    const agent = "did:web:agents.example.test:travel";
    const verifier = "did:web:tickets.example.test:hacp";
    const humanSigning = isolatedProvider(`${human}#authority-1`);
    const agentSigning = isolatedProvider(`${agent}#workload-1`);
    const verifierSigning = isolatedProvider(`${verifier}#receipt-1`);
    expect("privateKey" in humanSigning.provider).toBe(false);

    const proposal = await extractDecision({
      communication: "Book one ticket for no more than $600.",
      principal: { id: human, type: "HUMAN" },
      extractor: {
        extract: ({ evidence }) => ({
          intent: {
            type: "flight.purchase",
            statement: "Book one ticket.",
            parameters: { quantity: 1 },
          },
          constraints: {
            maxAmount: { currency: "USD", value: "600.00" },
            maxQuantity: 1,
          },
          fieldSources: [{ path: "/intent", basis: "ASSERTED", evidenceDigest: evidence.digest }],
        }),
      },
      now: () => now,
    });
    const decision = await attestDecisionWithProvider({
      decision: proposal,
      signer: humanSigning.provider,
    });
    const mandate = await issueMandateWithProvider({
      decision,
      issuer: human,
      subject: agent,
      signer: humanSigning.provider,
      permissions: ["flight.purchase"],
      audience: ["https://tickets.example.test"],
      notAfter: "2026-09-15T12:00:00.000Z",
    });
    const envelope = await createActionEnvelopeWithProvider({
      mandate,
      agent,
      signer: agentSigning.provider,
      action: {
        type: "flight.purchase",
        target: "https://tickets.example.test/flights/UA123",
        parameters: {
          quantity: 1,
          amount: { currency: "USD", value: "542.00" },
        },
      },
    });

    const store = new InMemoryHacpStore();
    store.putDecision(decision);
    store.putMandate(mandate);
    store.putKey(humanSigning.provider.verificationMethod, humanSigning.publicKey);
    store.putKey(agentSigning.provider.verificationMethod, agentSigning.publicKey);
    store.putKey(verifierSigning.provider.verificationMethod, verifierSigning.publicKey);

    const result = await verifyAction({
      actionEnvelope: envelope,
      authenticatedAgent: agent,
      audience: "https://tickets.example.test",
      resolveDecision: store.resolveDecision,
      resolveMandate: store.resolveMandate,
      resolveKey: store.resolveKey,
      authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
      revocations: store,
      nonces: new InMemoryNonceStore(() => now),
      policy: { version: "test@1", evaluate: () => ({ verdict: "ALLOW" }) },
      receiptSigner: verifierSigning.provider,
      verifier,
      now: () => now,
    });

    expect(result.receipt.verdict).toBe("ALLOW");
    expect(result.receipt.reasonCodes).toContain("INTENT_MATCH");
  });

  it("accepts only authenticated and authorized revocation records", async () => {
    const human = "did:web:example.test:users:alice";
    const signing = isolatedProvider(`${human}#authority-1`);
    const revocation = await createRevocationWithProvider({
      issuer: human,
      objectRef: "mandate_123",
      reason: "Approval withdrawn",
      signer: signing.provider,
    });
    const resolver = new VerifiedRevocationResolver({
      resolveRecords: () => [revocation],
      resolveKey: () => signing.publicKey,
      authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
      authorizeIssuer: (objectRef, issuer) => objectRef === "mandate_123" && issuer === human,
    });
    expect(await resolver.isRevoked("mandate_123", now)).toBe(true);

    const tampered = { ...revocation, reason: "Forged" };
    const strictResolver = new VerifiedRevocationResolver({
      resolveRecords: () => [tampered],
      resolveKey: () => signing.publicKey,
      authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
      authorizeIssuer: () => true,
    });
    await expect(strictResolver.isRevoked("mandate_123", now)).rejects.toThrow(
      "Revocation proof or issuer is invalid",
    );
  });
});

describe("production verification adapters", () => {
  it("atomically accepts a nonce only once through durable persistence", async () => {
    const consumed = new Set<string>();
    const store = new DurableNonceStore({
      consumeIfAbsent: ({ nonce, scope }) => {
        const key = `${scope}|${nonce}`;
        if (consumed.has(key)) return false;
        consumed.add(key);
        return true;
      },
    });

    const results = await Promise.all([
      store.consume("tickets|agent", "nonce-1", new Date("2026-09-15T00:00:00.000Z")),
      store.consume("tickets|agent", "nonce-1", new Date("2026-09-15T00:00:00.000Z")),
    ]);
    expect(results.sort()).toEqual([false, true]);
  });

  it("supports retired historical keys while rejecting compromised keys", async () => {
    const identity = "did:web:agents.example.test:travel";
    const signing = isolatedProvider(`${identity}#key-2026-01`);
    const baseRecord = {
      id: signing.provider.verificationMethod,
      controller: identity,
      publicKey: signing.publicKey,
      activatedAt: "2026-01-01T00:00:00.000Z",
      retiredAt: "2026-10-01T00:00:00.000Z",
    };
    const registry = new VerificationMethodRegistry(() => baseRecord);
    const context = {
      purpose: "hacp:action",
      proofCreatedAt: "2026-09-14T12:00:00.000Z",
      verificationTime: new Date("2026-10-02T00:00:00.000Z"),
    };
    expect(await registry.authorizeVerificationMethod(identity, baseRecord.id, context)).toBe(true);

    const revokedRegistry = new VerificationMethodRegistry(() => ({
      ...baseRecord,
      revokedAt: "2026-10-01T12:00:00.000Z",
    }));
    expect(
      await revokedRegistry.authorizeVerificationMethod(identity, baseRecord.id, context),
    ).toBe(false);
  });
});
