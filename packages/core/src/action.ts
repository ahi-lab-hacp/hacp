import { randomUUID } from "node:crypto";
import { createProof, createProofWithProvider, withoutProof } from "./crypto.js";
import { invariant } from "./errors.js";
import {
  type Action,
  type ActionEnvelope,
  HACP_VERSION,
  type Mandate,
  type Signer,
  type SigningProvider,
} from "./types.js";

export interface CreateActionEnvelopeOptions {
  action: Action;
  agent: string;
  id?: string;
  mandate: Mandate;
  nonce?: string;
  signer: Signer;
}

export interface CreateActionEnvelopeWithProviderOptions
  extends Omit<CreateActionEnvelopeOptions, "signer"> {
  signer: SigningProvider;
}

function createUnsignedActionEnvelope(
  options: Omit<CreateActionEnvelopeOptions, "signer">,
  now: Date,
): Omit<ActionEnvelope, "proof"> {
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

  return {
    hacpVersion: HACP_VERSION,
    type: "action-envelope",
    id: options.id ?? `act_${randomUUID()}`,
    mandateRef: options.mandate.id,
    agent: options.agent,
    action: options.action,
    nonce: options.nonce ?? randomUUID(),
    createdAt: now.toISOString(),
  };
}

export function createActionEnvelope(options: CreateActionEnvelopeOptions): ActionEnvelope {
  const unsigned = createUnsignedActionEnvelope(options, options.signer.now?.() ?? new Date());
  return { ...unsigned, proof: createProof(unsigned, "hacp:action", options.signer) };
}

export async function createActionEnvelopeWithProvider(
  options: CreateActionEnvelopeWithProviderOptions,
): Promise<ActionEnvelope> {
  const unsigned = createUnsignedActionEnvelope(options, options.signer.now?.() ?? new Date());
  return {
    ...unsigned,
    proof: await createProofWithProvider(unsigned, "hacp:action", options.signer),
  };
}

export function actionEnvelopePayload(envelope: ActionEnvelope): Omit<ActionEnvelope, "proof"> {
  return withoutProof(envelope);
}
