import {
  attestDecision,
  createActionEnvelope,
  generateEd25519KeyPair,
  InMemoryHacpStore,
  InMemoryNonceStore,
  issueMandate,
  type Decision,
  type Signer,
} from "@ahi-lab-hacp/core";
import { createHacpHandler, createHacpRequest } from "@ahi-lab-hacp/http";

const human = "did:web:acme.example:users:alice";
const agent = "did:web:agents.acme.example:travel";
const verifier = "did:web:api.example-air.com:hacp";
const humanKeys = generateEd25519KeyPair();
const agentKeys = generateEd25519KeyPair();
const verifierKeys = generateEd25519KeyPair();
const humanSigner: Signer = {
  privateKey: humanKeys.privateKey,
  verificationMethod: `${human}#hacp-1`,
};
const agentSigner: Signer = {
  privateKey: agentKeys.privateKey,
  verificationMethod: `${agent}#hacp-1`,
};
const receiptSigner: Signer = {
  privateKey: verifierKeys.privateKey,
  verificationMethod: `${verifier}#hacp-1`,
};

// In an application this proposal is produced by extractDecision(...) and then
// shown to Alice. It is deliberately non-authoritative until she attests it.
const proposal: Decision = {
  hacpVersion: "0.1",
  type: "decision",
  id: "dec_flight_demo",
  state: "PROPOSED",
  principal: { id: human, type: "HUMAN", organization: "did:web:acme.example" },
  intent: { type: "flight.purchase", statement: "Book a flight to NYC." },
  constraints: {
    destination: ["NYC"],
    maxAmount: { currency: "USD", value: "600.00" },
  },
  evidence: [
    {
      mediaType: "text/plain",
      digest: "sha256:example",
      disclosure: "DIGEST_ONLY",
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
  audience: ["https://api.example-air.com"],
  notAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});
const envelope = createActionEnvelope({
  mandate,
  agent,
  signer: agentSigner,
  action: {
    type: "flight.purchase",
    target: "https://api.example-air.com/flights/UA123",
    parameters: {
      destination: "NYC",
      amount: { currency: "USD", value: "542.00" },
    },
  },
});

const store = new InMemoryHacpStore();
store.putDecision(decision);
store.putMandate(mandate);
store.putKey(humanSigner.verificationMethod, humanKeys.publicKey);
store.putKey(agentSigner.verificationMethod, agentKeys.publicKey);
store.putKey(receiptSigner.verificationMethod, verifierKeys.publicKey);

const handler = createHacpHandler({
  authenticateAgent: () => agent, // Replace with mTLS, OAuth, or workload identity.
  resolveDecision: store.resolveDecision,
  resolveMandate: store.resolveMandate,
  resolveKey: store.resolveKey,
  authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
  revocations: store,
  nonces: new InMemoryNonceStore(),
  policy: { version: "example-policy@1", evaluate: () => ({ verdict: "ALLOW" }) },
  receiptSigner,
  verifier,
  onAllow: ({ verification }) =>
    Response.json({ purchased: true, action: verification.action, receipt: verification.receipt }),
});

const response = await handler(
  createHacpRequest(envelope.action.target, { method: "POST", envelope }),
);
console.log(JSON.stringify(await response.json(), null, 2));
