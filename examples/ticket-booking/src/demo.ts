import {
  attestDecision,
  createActionEnvelope,
  extractDecision,
  generateEd25519KeyPair,
  InMemoryHacpStore,
  InMemoryNonceStore,
  issueMandate,
  verifyReceipt,
  type ActionEnvelope,
  type DecisionExtractor,
  type Receipt,
  type Signer,
} from "@ahi-lab-hacp/core";
import { createHacpHandler, createHacpRequest } from "@ahi-lab-hacp/http";

export interface DemoOutcome {
  name: string;
  status: number;
  verdict: Receipt["verdict"];
  reasonCodes: string[];
  receiptSignatureValid: boolean;
}

export interface TicketBookingDemo {
  decisionId: string;
  mandateId: string;
  principal: string;
  agent: string;
  outcomes: DemoOutcome[];
}

const ticketApi = "https://tickets.example";
const human = "did:web:acme.example:users:alice";
const organization = "did:web:acme.example";
const agent = "did:web:agents.acme.example:travel";
const verifier = "did:web:tickets.example:hacp";

const extractor: DecisionExtractor = {
  extract: ({ evidence }) => ({
    intent: {
      type: "flight.purchase",
      statement: "Book Alice a Friday afternoon flight to New York for at most USD 600.",
      parameters: { destination: "NYC", departureWindow: "Friday afternoon" },
    },
    constraints: {
      destination: ["NYC"],
      maxAmount: { currency: "USD", value: "600.00" },
      allowedTargets: [ticketApi],
    },
    fieldSources: [
      { path: "/intent", basis: "ASSERTED", evidenceDigest: evidence.digest },
      { path: "/constraints/destination", basis: "ASSERTED", evidenceDigest: evidence.digest },
      { path: "/constraints/maxAmount", basis: "ASSERTED", evidenceDigest: evidence.digest },
    ],
  }),
};

export async function runTicketBookingDemo(): Promise<TicketBookingDemo> {
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

  // 1. Natural language becomes a proposal. It cannot authorize an action yet.
  const proposal = await extractDecision({
    communication: "Book me a Friday afternoon flight to NYC for no more than $600.",
    principal: { id: human, type: "HUMAN", organization },
    extractor,
    source: "urn:demo:chat:alice:message-1",
  });

  // 2. Alice confirms the exact structured object, then delegates narrow authority.
  const decision = attestDecision({ decision: proposal, signer: humanSigner });
  const mandate = issueMandate({
    decision,
    issuer: human,
    subject: agent,
    signer: humanSigner,
    permissions: ["flight.purchase"],
    constraints: decision.constraints,
    audience: [ticketApi],
    maxDelegationDepth: 0,
    notAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  const store = new InMemoryHacpStore();
  store.putDecision(decision);
  store.putMandate(mandate);
  store.putKey(humanSigner.verificationMethod, humanKeys.publicKey);
  store.putKey(agentSigner.verificationMethod, agentKeys.publicKey);
  store.putKey(receiptSigner.verificationMethod, verifierKeys.publicKey);

  // 3. The ticket server authenticates the workload independently, then verifies HACP.
  const handler = createHacpHandler({
    authenticateAgent: (request) =>
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "anonymous",
    resolveDecision: store.resolveDecision,
    resolveMandate: store.resolveMandate,
    resolveKey: store.resolveKey,
    authorizeVerificationMethod: (identity, method) => method.startsWith(`${identity}#`),
    revocations: store,
    nonces: new InMemoryNonceStore(),
    verifier,
    receiptSigner,
    policy: {
      version: "ticket-api/booking@1",
      evaluate: ({ action }) =>
        action.target.startsWith(`${ticketApi}/flights/`)
          ? { verdict: "ALLOW", reasonCodes: ["TICKET_POLICY_ALLOWED"] }
          : { verdict: "DENY", reasonCodes: ["TICKET_TARGET_DENIED"] },
    },
    onAllow: ({ verification }) =>
      Response.json({
        bookingCreated: true,
        flight: verification.action?.target,
        receipt: verification.receipt,
      }),
  });

  const envelopeFor = (amount: string): ActionEnvelope =>
    createActionEnvelope({
      mandate,
      agent,
      signer: agentSigner,
      action: {
        type: "flight.purchase",
        target: `${ticketApi}/flights/UA123`,
        parameters: {
          destination: "NYC",
          amount: { currency: "USD", value: amount },
        },
      },
    });

  const send = async (
    name: string,
    envelope: ActionEnvelope,
    authenticatedAs = agent,
  ): Promise<DemoOutcome> => {
    const response = await handler(
      createHacpRequest(envelope.action.target, {
        method: "POST",
        envelope,
        headers: { authorization: `Bearer ${authenticatedAs}` },
      }),
    );
    const body = (await response.json()) as { receipt: Receipt };
    return {
      name,
      status: response.status,
      verdict: body.receipt.verdict,
      reasonCodes: body.receipt.reasonCodes,
      receiptSignatureValid: await verifyReceipt(body.receipt, store.resolveKey),
    };
  };

  const wrongIdentity = await send(
    "wrong authenticated agent",
    envelopeFor("542.00"),
    "did:web:attacker.example",
  );
  const overBudget = await send("price exceeds human limit", envelopeFor("700.00"));
  const alteredEnvelope = envelopeFor("542.00");
  alteredEnvelope.action.parameters.destination = "SFO";
  const tampered = await send("action changed after signing", alteredEnvelope);
  const validEnvelope = envelopeFor("542.00");
  const allowed = await send("authorized booking", validEnvelope);
  const replay = await send("same action replayed", validEnvelope);

  return {
    decisionId: decision.id,
    mandateId: mandate.id,
    principal: human,
    agent,
    outcomes: [wrongIdentity, overBudget, tampered, allowed, replay],
  };
}
