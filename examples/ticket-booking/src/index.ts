import { runTicketBookingDemo } from "./demo.js";

const demo = await runTicketBookingDemo();

console.log("\nHACP ticket-booking demo");
console.log(`Human:   ${demo.principal}`);
console.log(`Agent:   ${demo.agent}`);
console.log(`Decision: ${demo.decision.id}`);
console.log(`Mandate:  ${demo.mandate.id}\n`);
console.table(
  demo.outcomes.map((outcome) => ({
    scenario: outcome.name,
    HTTP: outcome.status,
    verdict: outcome.verdict,
    receipt: outcome.receiptSignatureValid ? "valid signature" : "INVALID",
    reasons: outcome.reasonCodes.join(", "),
  })),
);
