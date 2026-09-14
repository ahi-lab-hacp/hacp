import { describe, expect, it } from "vitest";
import { runTicketBookingDemo } from "./demo.js";

describe("ticket-booking example", () => {
  it("allows only the authenticated, signed, in-scope action and rejects replay", async () => {
    const demo = await runTicketBookingDemo();
    expect(demo.outcomes.map(({ name, verdict }) => ({ name, verdict }))).toEqual([
      { name: "wrong authenticated agent", verdict: "DENY" },
      { name: "price exceeds human limit", verdict: "DENY" },
      { name: "quantity exceeds human intent", verdict: "DENY" },
      { name: "action changed after signing", verdict: "DENY" },
      { name: "authorized booking", verdict: "ALLOW" },
      { name: "same action replayed", verdict: "DENY" },
    ]);
    expect(demo.outcomes.every((outcome) => outcome.receiptSignatureValid)).toBe(true);
    expect(demo.outcomes.at(-1)?.reasonCodes).toContain("REPLAY_DETECTED");
    expect(demo.discovery.verificationMethods).toHaveLength(3);
    expect(demo.decision.attestation?.assuranceLevel).toBe("HACP_L2");
    expect(demo.mandate.decisionRef).toBe(demo.decision.id);
    expect(demo.outcomes.every((outcome) => outcome.receipt.mandateRef === demo.mandate.id)).toBe(
      true,
    );
  });
});
