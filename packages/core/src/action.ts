import { randomUUID } from "node:crypto";
import { createProof, withoutProof } from "./crypto.js";
import { invariant } from "./errors.js";
import {
  HACP_VERSION,
  type Action,
  type ActionEnvelope,
  type Mandate,
  type Signer,
} from "./types.js";

export interface CreateActionEnvelopeOptions {
  action: Action;
  agent: string;
  id?: string;
  mandate: Mandate;
  nonce?: string;
  signer: Signer;
}

export function createActionEnvelope(options: CreateActionEnvelopeOptions): ActionEnvelope {
  invariant(
    options.agent === options.mandate.subject,
    "AGENT_AUTHENTICATION_FAILED",
    "Action agent must equal the Mandate subject",
  );
  invariant(
    options.mandate.permissions.includes(options.action.type),
    "ACTION_OUT_OF_SCOPE",
    "Action type is not granted by the Mandate",
  );

  const unsigned: Omit<ActionEnvelope, "proof"> = {
    hacpVersion: HACP_VERSION,
    type: "action-envelope",
    id: options.id ?? `act_${randomUUID()}`,
    mandateRef: options.mandate.id,
    agent: options.agent,
    action: options.action,
    nonce: options.nonce ?? randomUUID(),
    createdAt: (options.signer.now?.() ?? new Date()).toISOString(),
  };
  return { ...unsigned, proof: createProof(unsigned, "hacp:action", options.signer) };
}

export function actionEnvelopePayload(envelope: ActionEnvelope): Omit<ActionEnvelope, "proof"> {
  return withoutProof(envelope);
}
