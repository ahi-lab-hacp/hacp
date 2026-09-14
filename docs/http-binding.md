# HTTP binding

The Fetch-compatible binding carries one signed `ActionEnvelope` as the request body.

```http
POST /flights/UA123 HTTP/1.1
Host: api.example-air.com
Content-Type: application/hacp+json
HACP-Version: 0.1

{ "hacpVersion": "0.1", "type": "action-envelope", "...": "..." }
```

The receiver authenticates the caller using its existing mechanism, such as mTLS, OAuth, or workload identity. It must not derive `authenticatedAgent` from the request body.

```ts
const result = await verifyHacpRequest(request, {
  authenticatedAgent: identityFromTransport,
  audience: new URL(request.url).origin,
  ...verificationDependencies,
});
```

Responses use `application/hacp+json` and contain a signed Receipt:

- `200` for `ALLOW`;
- `202` for `REVIEW`;
- `403` for `DENY`;
- `400` or `422` for binding-level malformed input.

An application may return its business response together with the Receipt after an allowed effect. The Receipt should be committed atomically before or with the protected effect.

## Reverse proxies

The verifier must receive a trustworthy authenticated identity and effective request origin. Do not trust client-supplied forwarding headers unless a configured proxy has removed and rewritten them. Intermediaries must not rewrite signed action fields, nonces, or canonical objects.
