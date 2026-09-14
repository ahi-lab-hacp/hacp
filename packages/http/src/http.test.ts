import { describe, expect, it } from "vitest";
import {
  createActionEnvelope,
  generateEd25519KeyPair,
  HacpError,
  HACP_VERSION,
  InMemoryNonceStore,
  type ActionEnvelope,
  type Mandate,
  type Signer,
} from "@ahi-lab-hacp/core";
import {
  createHacpDiscoveryDocument,
  createHacpDiscoveryResponse,
  createHacpHandler,
  createHacpRequest,
  createVerificationResponse,
  parseActionEnvelope,
  requireHacp,
  verifyHacpRequest,
} from "./index.js";

const now = new Date("2026-09-13T00:00:00.000Z");

function verificationFixture() {
  const agent = "did:web:agent.example";
  const agentKeys = generateEd25519KeyPair();
  const verifierKeys = generateEd25519KeyPair();
  const agentSigner: Signer = {
    privateKey: agentKeys.privateKey,
    verificationMethod: `${agent}#key-1`,
    now: () => now,
  };
  const receiptSigner: Signer = {
    privateKey: verifierKeys.privateKey,
    verificationMethod: "did:web:api.example#key-1",
    now: () => now,
  };
  const unresolvedMandate = {
    hacpVersion: HACP_VERSION,
    type: "mandate",
    id: "mandate_missing",
    issuer: "did:web:human.example",
    subject: agent,
    decisionRef: "decision_missing",
    permissions: ["test.run"],
    constraints: {},
    audience: ["https://api.example"],
    maxDelegationDepth: 0,
    validFrom: now.toISOString(),
    notAfter: "2026-09-14T00:00:00.000Z",
    nonce: "mandate-nonce",
    proof: {
      type: "Ed25519Signature2020",
      verificationMethod: "did:web:human.example#key-1",
      createdAt: now.toISOString(),
      proofValue: "unresolved",
    },
  } satisfies Mandate;
  const envelope = createActionEnvelope({
    action: { type: "test.run", target: "https://api.example/action", parameters: {} },
    agent,
    id: "act_signed",
    mandate: unresolvedMandate,
    nonce: "nonce-signed",
    signer: agentSigner,
  });
  const options = {
    authorizeVerificationMethod: (identity: string, method: string) =>
      method.startsWith(`${identity}#`),
    now: () => now,
    nonces: new InMemoryNonceStore(() => now),
    policy: { version: "test@1", evaluate: () => ({ verdict: "ALLOW" as const }) },
    receiptSigner,
    resolveDecision: () => {
      throw new HacpError("OBJECT_NOT_FOUND", "Decision not found");
    },
    resolveKey: (method: string) => {
      if (method === agentSigner.verificationMethod) return agentKeys.publicKey;
      if (method === receiptSigner.verificationMethod) return verifierKeys.publicKey;
      throw new HacpError("INVALID_PROOF", "Key not found");
    },
    resolveMandate: () => {
      throw new HacpError("OBJECT_NOT_FOUND", "Mandate not found");
    },
    revocations: { isRevoked: () => false },
    verifier: "did:web:api.example",
  };
  return { agent, envelope, options };
}

describe("HTTP binding", () => {
  it("publishes only explicit public discovery key fields", async () => {
    const document = createHacpDiscoveryDocument({
      issuer: "https://authority.example/hacp",
      verifier: "https://api.example/hacp/verifier",
      audience: "https://api.example/bookings",
      verificationMethods: [
        {
          id: "https://authority.example/.well-known/hacp.json#key-1",
          controller: "https://authority.example/hacp",
          algorithm: "Ed25519",
          publicKeyPem: "PUBLIC KEY",
          privateKey: "MUST NOT LEAK",
        } as Parameters<typeof createHacpDiscoveryDocument>[0]["verificationMethods"][number],
      ],
      actions: [{ action: "flight.purchase", assuranceLevels: ["HACP_L2", "HACP_L3"] }],
    });
    const response = createHacpDiscoveryResponse(document);
    const body = await response.text();

    expect(response.headers.get("HACP-Version")).toBe("0.1");
    expect(response.headers.get("content-type")).toContain("application/hacp+json");
    expect(document.audience).toBe("https://api.example");
    expect(document.algorithms).toEqual(["Ed25519"]);
    expect(body).toContain("PUBLIC KEY");
    expect(body).not.toContain("MUST NOT LEAK");
  });

  it("encodes and parses an action envelope", async () => {
    const envelope = {
      hacpVersion: HACP_VERSION,
      type: "action-envelope",
      id: "act_test",
      mandateRef: "mandate_test",
      agent: "did:web:agent.example",
      action: { type: "test.run", target: "https://api.example/action", parameters: {} },
      nonce: "nonce",
      createdAt: "2026-09-13T00:00:00.000Z",
      proof: {
        type: "Ed25519Signature2020",
        verificationMethod: "did:web:agent.example#key-1",
        createdAt: "2026-09-13T00:00:00.000Z",
        proofValue: "test",
      },
    } satisfies ActionEnvelope;
    const request = createHacpRequest("https://api.example/action", { envelope });
    expect(request.headers.get("HACP-Version")).toBe("0.1");
    expect(await parseActionEnvelope(request)).toEqual(envelope);
  });

  it("rejects an unsupported content type", async () => {
    const request = new Request("https://api.example/action", {
      method: "POST",
      headers: { "content-type": "application/json", "HACP-Version": "0.1" },
      body: "{}",
    });
    await expect(parseActionEnvelope(request)).rejects.toMatchObject({
      code: "MALFORMED_ENVELOPE",
    });
  });

  it("rejects an unsupported protocol version", async () => {
    const request = new Request("https://api.example/action", {
      method: "POST",
      headers: { "content-type": "application/hacp+json", "HACP-Version": "9.9" },
      body: "{}",
    });
    await expect(parseActionEnvelope(request)).rejects.toMatchObject({
      code: "VERSION_NOT_SUPPORTED",
    });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("https://api.example/action", {
      method: "POST",
      headers: { "content-type": "application/hacp+json", "HACP-Version": "0.1" },
      body: "{",
    });
    await expect(parseActionEnvelope(request)).rejects.toMatchObject({
      code: "MALFORMED_ENVELOPE",
    });
  });

  it("connects HTTP requests to the protocol verifier", async () => {
    const fixture = verificationFixture();
    const request = createHacpRequest("https://api.example/action", {
      envelope: fixture.envelope,
    });
    const result = await verifyHacpRequest(request, {
      ...fixture.options,
      authenticatedAgent: fixture.agent,
    });
    expect(result.receipt.verdict).toBe("DENY");
    expect(result.receipt.reasonCodes).toContain("OBJECT_NOT_FOUND");
  });

  it("maps verification verdicts to HTTP status codes", async () => {
    const fixture = verificationFixture();
    const denied = await verifyHacpRequest(
      createHacpRequest("https://api.example/action", { envelope: fixture.envelope }),
      { ...fixture.options, authenticatedAgent: fixture.agent },
    );
    expect(createVerificationResponse(denied).status).toBe(403);
    expect(
      createVerificationResponse({
        ...denied,
        receipt: { ...denied.receipt, verdict: "REVIEW" },
      }).status,
    ).toBe(202);
    expect(
      createVerificationResponse({
        ...denied,
        receipt: { ...denied.receipt, verdict: "ALLOW" },
      }).status,
    ).toBe(200);
  });

  it("returns a protocol response when middleware verification denies the request", async () => {
    const fixture = verificationFixture();
    const handler = createHacpHandler({
      ...fixture.options,
      authenticateAgent: () => fixture.agent,
      onAllow: () => new Response("unexpected"),
    });
    const response = await handler(
      createHacpRequest("https://api.example/action", { envelope: fixture.envelope }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/hacp+json");
  });

  it("keeps the protected operation behind the default-deny receiver boundary", async () => {
    const fixture = verificationFixture();
    let effects = 0;
    const handler = requireHacp({
      ...fixture.options,
      authenticateAgent: () => fixture.agent,
      onAllow: () => {
        effects += 1;
        return new Response("effect completed");
      },
    });

    const response = await handler(
      createHacpRequest("https://api.example/action", { envelope: fixture.envelope }),
    );

    expect(response.status).toBe(403);
    expect(effects).toBe(0);
  });
});
