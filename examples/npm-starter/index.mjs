import assert from "node:assert/strict";
import {
  attestDecision,
  createActionEnvelope,
  generateEd25519KeyPair,
  InMemoryHacpStore,
  InMemoryNonceStore,
  issueMandate,
} from "@ahi-lab-hacp/core";
import { createHacpHandler, createHacpRequest } from "@ahi-lab-hacp/http";

const human = "did:web:example.com:users:alice";
const agent = "did:web:agents.example.com:travel";
const receiver = "https://tickets.example";
const verifier = `${receiver}/hacp/verifier`;

const humanKeys = generateEd25519KeyPair();
const agentKeys = generateEd25519KeyPair();
const verifierKeys = generateEd25519KeyPair();
const humanSigner = {
  privateKey: humanKeys.privateKey,
  verificationMethod: `${human}#hacp-1`,
};
const agentSigner = {
  privateKey: agentKeys.privateKey,
  verificationMethod: `${agent}#hacp-1`,
};
const receiptSigner = {
  privateKey: verifierKeys.privateKey,
  verificationMethod: `${verifier}#hacp-1`,
};

// AGENT SIDE: Alice reviews this exact object before it becomes authoritative.
const proposal = {
  hacpVersion: "0.1",
  type: "decision",
  id: "dec_starter_flight",
  state: "PROPOSED",
  principal: { id: human, type: "HUMAN" },
  intent: {
    type: "flight.purchase",
    statement: "Buy one Friday afternoon ticket to New York.",
    parameters: {
      destination: "NYC",
      departureWindow: "Friday afternoon",
      quantity: 1,
    },
  },
  constraints: {
    destination: ["NYC"],
    maxAmount: { currency: "USD", value: "600.00" },
    maxQuantity: 1,
    allowedTargets: [receiver],
  },
  evidence: [
    {
      digest: "sha256:replace-with-the-real-evidence-digest",
      disclosure: "DIGEST_ONLY",
      mediaType: "text/plain",
    },
  ],
  fieldSources: [{ path: "/intent", basis: "ASSERTED" }],
  createdAt: new Date().toISOString(),
};

const decision = attestDecision({ decision: proposal, signer: humanSigner });
const mandate = issueMandate({
  decision,
  issuer: human,
  subject: agent,
  signer: humanSigner,
  permissions: ["flight.purchase"],
  constraints: decision.constraints,
  audience: [receiver],
  maxDelegationDepth: 0,
  notAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
});
const envelope = createActionEnvelope({
  mandate,
  agent,
  signer: agentSigner,
  action: {
    type: "flight.purchase",
    target: `${receiver}/flights/UA123`,
    parameters: {
      destination: "NYC",
      departureWindow: "Friday afternoon",
      quantity: 1,
      amount: { currency: "USD", value: "542.00" },
    },
  },
});

// RECEIVER SIDE: only public keys and resolvable protocol objects cross this boundary.
const store = new InMemoryHacpStore();
store.putDecision(decision);
store.putMandate(mandate);
store.putKey(humanSigner.verificationMethod, humanKeys.publicKey);
store.putKey(agentSigner.verificationMethod, agentKeys.publicKey);
store.putKey(receiptSigner.verificationMethod, verifierKeys.publicKey);

const verifyTicketRequest = createHacpHandler({
  authenticateAgent: (request) => ({
    id: request.headers.get("authorization") === "Bearer demo-agent-token" ? agent : "anonymous",
    method: "DEMO_WORKLOAD_IDENTITY",
  }),
  resolveDecision: store.resolveDecision,
  resolveMandate: store.resolveMandate,
  resolveKey: store.resolveKey,
  authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
  revocations: store,
  nonces: new InMemoryNonceStore(),
  verifier,
  receiptSigner,
  policy: {
    version: "starter-ticket-policy@1",
    evaluate: () => ({ verdict: "ALLOW", reasonCodes: ["LOCAL_POLICY_ALLOWED"] }),
  },
  onAllow: ({ authentication, verification }) =>
    Response.json({
      bookingCreated: true,
      authenticatedAgent: authentication,
      action: verification.action,
      receipt: verification.receipt,
    }),
});

const request = createHacpRequest(envelope.action.target, {
  method: "POST",
  envelope,
  headers: { authorization: "Bearer demo-agent-token" },
});
const response = await verifyTicketRequest(request);
const result = await response.json();

assert.equal(response.status, 200);
assert.equal(result.bookingCreated, true);
assert.equal(result.receipt.verdict, "ALLOW");

console.log("HACP verification: ALLOW");
console.log(`Decision: ${decision.id}`);
console.log(`Mandate: ${mandate.id}`);
console.log(`ActionEnvelope: ${envelope.id}`);
console.log(`Receipt: ${result.receipt.id}`);
