import { describe, expect, it } from "vitest";
import {
  attestDecision,
  canonicalize,
  createActionEnvelope,
  createRevocation,
  delegateMandate,
  extractDecision,
  generateEd25519KeyPair,
  InMemoryHacpStore,
  InMemoryNonceStore,
  issueMandate,
  verifyAction,
  verifyReceipt,
} from "./index.js";
import type { DecisionExtractor, Signer, VerificationOptions } from "./types.js";

const now = new Date("2026-09-13T12:00:00.000Z");

function fixture() {
  const human = "did:web:acme.example:users:alice";
  const agent = "did:web:agents.acme.example:travel";
  const verifier = "did:web:api.example-air.com:hacp";
  const humanKeys = generateEd25519KeyPair();
  const agentKeys = generateEd25519KeyPair();
  const verifierKeys = generateEd25519KeyPair();
  const humanSigner: Signer = {
    privateKey: humanKeys.privateKey,
    verificationMethod: `${human}#hacp-1`,
    now: () => now,
  };
  const agentSigner: Signer = {
    privateKey: agentKeys.privateKey,
    verificationMethod: `${agent}#hacp-1`,
    now: () => now,
  };
  const receiptSigner: Signer = {
    privateKey: verifierKeys.privateKey,
    verificationMethod: `${verifier}#hacp-1`,
    now: () => now,
  };
  const store = new InMemoryHacpStore();
  store.putKey(humanSigner.verificationMethod, humanKeys.publicKey);
  store.putKey(agentSigner.verificationMethod, agentKeys.publicKey);
  store.putKey(receiptSigner.verificationMethod, verifierKeys.publicKey);
  return { human, agent, verifier, humanSigner, agentSigner, receiptSigner, store };
}

const extractor: DecisionExtractor = {
  extract: ({ evidence }) => ({
    intent: {
      type: "flight.purchase",
      statement: "Buy one flight to NYC for at most USD 600.",
      parameters: { destination: "NYC", quantity: 1 },
    },
    constraints: {
      destination: ["NYC"],
      maxAmount: { currency: "USD", value: "600.00" },
      maxQuantity: 1,
    },
    fieldSources: [
      { path: "/intent", basis: "ASSERTED", evidenceDigest: evidence.digest },
      { path: "/constraints/maxAmount", basis: "ASSERTED", evidenceDigest: evidence.digest },
    ],
  }),
};

async function authorizedFlow(amount = "542.00") {
  const context = fixture();
  const proposal = await extractDecision({
    communication: "Buy a flight to NYC for at most $600.",
    principal: { id: context.human, type: "HUMAN", organization: "did:web:acme.example" },
    extractor,
    id: "dec_test",
    now: () => now,
  });
  const decision = attestDecision({ decision: proposal, signer: context.humanSigner });
  const mandate = issueMandate({
    decision,
    issuer: context.human,
    subject: context.agent,
    signer: context.humanSigner,
    permissions: ["flight.purchase"],
    constraints: decision.constraints,
    audience: ["https://api.example-air.com"],
    maxDelegationDepth: 1,
    notAfter: "2026-09-14T12:00:00.000Z",
    id: "mandate_test",
    nonce: "mandate-nonce",
  });
  const envelope = createActionEnvelope({
    mandate,
    agent: context.agent,
    signer: context.agentSigner,
    id: `act_${amount}`,
    nonce: `action-nonce-${amount}`,
    action: {
      type: "flight.purchase",
      target: "https://api.example-air.com/flights/UA123",
      parameters: {
        destination: "NYC",
        quantity: 1,
        amount: { currency: "USD", value: amount },
      },
    },
  });
  context.store.putDecision(decision);
  context.store.putMandate(mandate);
  const options: VerificationOptions = {
    actionEnvelope: envelope,
    authenticatedAgent: context.agent,
    audience: "https://api.example-air.com",
    resolveDecision: context.store.resolveDecision,
    resolveMandate: context.store.resolveMandate,
    resolveKey: context.store.resolveKey,
    authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
    revocations: context.store,
    nonces: new InMemoryNonceStore(() => now),
    policy: { version: "test-policy@1", evaluate: () => ({ verdict: "ALLOW" }) },
    receiptSigner: context.receiptSigner,
    verifier: context.verifier,
    now: () => now,
  };
  return { ...context, decision, mandate, envelope, options };
}

describe("canonicalize", () => {
  it("orders object members deterministically", () => {
    expect(canonicalize({ z: 1, a: { d: true, b: "x" } })).toBe('{"a":{"b":"x","d":true},"z":1}');
  });

  it("rejects non-JSON numeric values", () => {
    expect(() => canonicalize({ value: Number.NaN })).toThrow("Non-finite numbers");
  });
});

describe("HACP authorization flow", () => {
  it("allows a signed action within the attested mandate", async () => {
    const flow = await authorizedFlow();
    const result = await verifyAction(flow.options);
    expect(result.receipt.verdict).toBe("ALLOW");
    expect(result.receipt.reasonCodes).toContain("AGENT_IDENTITY_BOUND");
    expect(await verifyReceipt(result.receipt, flow.store.resolveKey)).toBe(true);
  });

  it("denies a caller whose authenticated identity does not match", async () => {
    const flow = await authorizedFlow();
    const result = await verifyAction({
      ...flow.options,
      authenticatedAgent: "did:web:attacker.example",
    });
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("AGENT_AUTHENTICATION_FAILED");
  });

  it("denies a modified envelope after signing", async () => {
    const flow = await authorizedFlow();
    flow.envelope.action.parameters.destination = "SFO";
    const result = await verifyAction(flow.options);
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("ACTION_SIGNATURE_INVALID");
  });

  it("denies an action that exceeds a quantitative constraint", async () => {
    const flow = await authorizedFlow("700.00");
    const result = await verifyAction(flow.options);
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("CONSTRAINT_VIOLATION:maxAmount");
  });

  it("denies a signed action whose parameters do not match the human intent", async () => {
    const flow = await authorizedFlow();
    const mismatched = createActionEnvelope({
      mandate: flow.mandate,
      agent: flow.agent,
      signer: flow.agentSigner,
      nonce: "action-nonce-quantity-mismatch",
      action: {
        ...flow.envelope.action,
        parameters: { ...flow.envelope.action.parameters, quantity: 100 },
      },
    });
    const result = await verifyAction({ ...flow.options, actionEnvelope: mismatched });
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("INTENT_PARAMETER_MISMATCH:quantity");
  });

  it("rejects a root Mandate permission that differs from the signed intent", async () => {
    const flow = await authorizedFlow();
    expect(() =>
      issueMandate({
        decision: flow.decision,
        issuer: flow.human,
        subject: flow.agent,
        signer: flow.humanSigner,
        permissions: ["account.delete"],
        constraints: flow.decision.constraints,
        audience: ["https://api.example-air.com"],
        notAfter: "2026-09-14T12:00:00.000Z",
      }),
    ).toThrow("permissions must match");
  });

  it("denies a request sent to an audience outside the mandate", async () => {
    const flow = await authorizedFlow();
    const result = await verifyAction({
      ...flow.options,
      audience: "https://api.untrusted.example",
    });
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("AUDIENCE_MISMATCH");
  });

  it("denies a mandate after its expiry", async () => {
    const flow = await authorizedFlow();
    const result = await verifyAction({
      ...flow.options,
      now: () => new Date("2026-09-15T12:00:00.000Z"),
    });
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("MANDATE_EXPIRED");
  });

  it("denies an action authorized by a revoked mandate", async () => {
    const flow = await authorizedFlow();
    flow.store.putRevocation(
      createRevocation({
        issuer: flow.human,
        objectRef: flow.mandate.id,
        reason: "Authorization withdrawn by the principal",
        signer: flow.humanSigner,
      }),
    );
    const result = await verifyAction(flow.options);
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("MANDATE_REVOKED");
  });

  it("returns REVIEW when local policy requires human intervention", async () => {
    const flow = await authorizedFlow();
    const result = await verifyAction({
      ...flow.options,
      policy: {
        version: "test-policy@2",
        evaluate: () => ({ verdict: "REVIEW", reasonCodes: ["MANUAL_APPROVAL_REQUIRED"] }),
      },
    });
    expect(result.receipt.verdict).toBe("REVIEW");
    expect(result.receipt.reasonCodes).toContain("MANUAL_APPROVAL_REQUIRED");
  });

  it("rejects replay of an already consumed nonce", async () => {
    const flow = await authorizedFlow();
    expect((await verifyAction(flow.options)).receipt.verdict).toBe("ALLOW");
    const replay = await verifyAction(flow.options);
    expect(replay.receipt.verdict).toBe("DENY");
    expect(replay.receipt.reasonCodes).toContain("REPLAY_DETECTED");
  });
});

describe("delegation attenuation", () => {
  it("allows a narrower child and rejects an expansion", async () => {
    const flow = await authorizedFlow();
    const serviceKeys = generateEd25519KeyPair();
    const serviceSigner: Signer = {
      privateKey: serviceKeys.privateKey,
      verificationMethod: `${flow.agent}#hacp-1`,
      now: () => now,
    };
    const child = await delegateMandate({
      parent: flow.mandate,
      subject: "did:web:agents.acme.example:booking-worker",
      signer: serviceSigner,
      permissions: ["flight.purchase"],
      constraints: {
        destination: ["NYC"],
        maxAmount: { currency: "USD", value: "500.00" },
        maxQuantity: 1,
      },
      audience: ["https://api.example-air.com"],
      notAfter: "2026-09-14T10:00:00.000Z",
    });
    expect(child.maxDelegationDepth).toBe(0);
    await expect(
      delegateMandate({
        parent: flow.mandate,
        subject: "did:web:agents.acme.example:booking-worker",
        signer: serviceSigner,
        permissions: ["flight.purchase", "account.delete"],
        constraints: flow.mandate.constraints,
        audience: flow.mandate.audience,
        notAfter: flow.mandate.notAfter,
      }),
    ).rejects.toThrow("permissions exceed");
  });
});
