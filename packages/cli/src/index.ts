import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  canonicalize,
  digestObject,
  generateEd25519KeyPair,
  type Receipt,
  verifyReceipt,
} from "@ahi-lab-hacp/core";

const usage = `HACP command-line interface

Usage:
  hacp keygen --id <verification-method> [--public <file>] [--private <file>]
  hacp digest --input <json-file>
  hacp canonicalize --input <json-file>
  hacp verify-receipt --input <receipt.json> --public <public-key.pem>
`;

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      id: { type: "string" },
      input: { type: "string" },
      private: { type: "string", default: "hacp-private.pem" },
      public: { type: "string", default: "hacp-public.pem" },
    },
    strict: true,
  });

  if (command === "keygen") {
    if (!values.id) {
      process.stderr.write("keygen requires --id <verification-method>\n");
      process.exitCode = 2;
      return;
    }
    const pair = generateEd25519KeyPair();
    await Promise.all([
      writeFile(values.private, pair.privateKey, { mode: 0o600 }),
      writeFile(values.public, pair.publicKey),
    ]);
    process.stdout.write(
      `${JSON.stringify({ verificationMethod: values.id, privateKey: values.private, publicKey: values.public }, null, 2)}\n`,
    );
    return;
  }

  if ((command === "digest" || command === "canonicalize") && values.input) {
    const value = await readJson(values.input);
    process.stdout.write(`${command === "digest" ? digestObject(value) : canonicalize(value)}\n`);
    return;
  }

  if (command === "verify-receipt" && values.input && values.public) {
    const receipt = (await readJson(values.input)) as Receipt;
    const publicKey = await readFile(values.public, "utf8");
    const valid = await verifyReceipt(receipt, () => publicKey);
    process.stdout.write(`${JSON.stringify({ valid, receiptId: receipt.id })}\n`);
    process.exitCode = valid ? 0 : 1;
    return;
  }

  process.stderr.write(usage);
  process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
