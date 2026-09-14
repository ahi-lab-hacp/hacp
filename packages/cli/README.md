# `@ahi-lab-hacp/cli`

Command-line tooling for HACP development and auditing.

```bash
hacp keygen --id did:web:agent.example#hacp-1
hacp canonicalize --input decision.json
hacp digest --input decision.json
hacp verify-receipt --input receipt.json --public verifier-public.pem
```

`keygen` writes an Ed25519 PKCS#8 private key with owner-only permissions and an SPKI public key. Treat generated private keys as secrets. For production, prefer a managed or hardware-backed signer.
