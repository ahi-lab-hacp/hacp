import {
  HACP_VERSION,
  HacpError,
  type ActionEnvelope,
  type AssuranceLevel,
  type VerificationOptions,
  type VerificationResult,
  verifyAction,
} from "@ahi-lab-hacp/core";

export const HACP_MEDIA_TYPE = "application/hacp+json";
export const HACP_VERSION_HEADER = "HACP-Version";

export type HacpPublicKeyMaterial =
  | { publicKeyJwk: JsonWebKey; publicKeyPem?: never }
  | { publicKeyJwk?: never; publicKeyPem: string };

export type HacpVerificationMethod = HacpPublicKeyMaterial & {
  algorithm: "Ed25519";
  controller: string;
  id: string;
};

export interface HacpActionRequirement {
  action: string;
  assuranceLevels: AssuranceLevel[];
}

export interface HacpDiscoveryDocument {
  actions?: HacpActionRequirement[];
  algorithms: string[];
  audience: string;
  hacpVersion: typeof HACP_VERSION;
  issuer: string;
  verificationMethods: HacpVerificationMethod[];
  verifier: string;
}

export type CreateHacpDiscoveryOptions = Omit<HacpDiscoveryDocument, "algorithms" | "hacpVersion">;

/**
 * Creates the public metadata a receiver publishes at `/.well-known/hacp.json`.
 * Only explicitly selected public-key fields are copied to prevent accidental
 * serialization of private key material from key-management objects.
 */
export function createHacpDiscoveryDocument(
  options: CreateHacpDiscoveryOptions,
): HacpDiscoveryDocument {
  const verificationMethods = options.verificationMethods.map((method) => ({
    id: method.id,
    controller: method.controller,
    algorithm: method.algorithm,
    ...(method.publicKeyJwk
      ? { publicKeyJwk: method.publicKeyJwk }
      : { publicKeyPem: method.publicKeyPem }),
  }));

  return {
    hacpVersion: HACP_VERSION,
    issuer: options.issuer,
    verifier: options.verifier,
    audience: new URL(options.audience).origin,
    algorithms: [...new Set(verificationMethods.map((method) => method.algorithm))].sort(),
    verificationMethods,
    ...(options.actions ? { actions: options.actions } : {}),
  };
}

export function createHacpDiscoveryResponse(document: HacpDiscoveryDocument): Response {
  return Response.json(document, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": HACP_MEDIA_TYPE,
      [HACP_VERSION_HEADER]: HACP_VERSION,
    },
  });
}

export interface CreateHacpRequestOptions extends Omit<RequestInit, "body"> {
  envelope: ActionEnvelope;
}

export function createHacpRequest(url: string | URL, options: CreateHacpRequestOptions): Request {
  const headers = new Headers(options.headers);
  headers.set("content-type", HACP_MEDIA_TYPE);
  headers.set(HACP_VERSION_HEADER, HACP_VERSION);
  return new Request(url, {
    ...options,
    method: options.method ?? "POST",
    headers,
    body: JSON.stringify(options.envelope),
  });
}

export async function parseActionEnvelope(request: Request): Promise<ActionEnvelope> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (mediaType !== HACP_MEDIA_TYPE) {
    throw new HacpError(
      "MALFORMED_ENVELOPE",
      `Expected content-type ${HACP_MEDIA_TYPE}, received ${mediaType ?? "none"}`,
    );
  }
  const version = request.headers.get(HACP_VERSION_HEADER);
  if (version !== HACP_VERSION) {
    throw new HacpError(
      "VERSION_NOT_SUPPORTED",
      `Expected HACP-Version ${HACP_VERSION}, received ${version ?? "none"}`,
    );
  }
  try {
    return (await request.json()) as ActionEnvelope;
  } catch (error) {
    throw new HacpError("MALFORMED_ENVELOPE", "Request body is not valid JSON", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface VerifyHacpRequestOptions
  extends Omit<VerificationOptions, "actionEnvelope" | "authenticatedAgent" | "audience"> {
  authenticatedAgent: string;
  audience?: string;
}

export async function verifyHacpRequest(
  request: Request,
  options: VerifyHacpRequestOptions,
): Promise<VerificationResult> {
  const actionEnvelope = await parseActionEnvelope(request);
  return verifyAction({
    ...options,
    actionEnvelope,
    audience: options.audience ?? new URL(request.url).origin,
    authenticatedAgent: options.authenticatedAgent,
  });
}

export function createVerificationResponse(result: VerificationResult): Response {
  const status =
    result.receipt.verdict === "ALLOW" ? 200 : result.receipt.verdict === "REVIEW" ? 202 : 403;
  return Response.json(
    { receipt: result.receipt },
    {
      status,
      headers: {
        "content-type": HACP_MEDIA_TYPE,
        [HACP_VERSION_HEADER]: HACP_VERSION,
      },
    },
  );
}

export interface HacpHandlerContext {
  request: Request;
  verification: VerificationResult;
}

export interface CreateHacpHandlerOptions
  extends Omit<VerifyHacpRequestOptions, "authenticatedAgent"> {
  authenticateAgent(request: Request): Promise<string> | string;
  onAllow(context: HacpHandlerContext): Promise<Response> | Response;
}

export function createHacpHandler(
  options: CreateHacpHandlerOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const authenticatedAgent = await options.authenticateAgent(request);
      const verification = await verifyHacpRequest(request, { ...options, authenticatedAgent });
      if (verification.receipt.verdict !== "ALLOW") return createVerificationResponse(verification);
      return options.onAllow({ request, verification });
    } catch (error) {
      if (!(error instanceof HacpError)) throw error;
      return Response.json(
        { error: { code: error.code, message: error.message } },
        {
          status: error.code === "VERSION_NOT_SUPPORTED" ? 400 : 422,
          headers: { "content-type": HACP_MEDIA_TYPE, [HACP_VERSION_HEADER]: HACP_VERSION },
        },
      );
    }
  };
}

/**
 * Creates a default-deny boundary for a consequential receiver operation.
 * The protected callback is invoked only after the complete HACP chain passes.
 */
export function requireHacp(
  options: CreateHacpHandlerOptions,
): (request: Request) => Promise<Response> {
  return createHacpHandler(options);
}
