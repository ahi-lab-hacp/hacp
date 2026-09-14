# `@ahi-lab-hacp/http`

Fetch-compatible HTTP binding for HACP 0.1.

```ts
import {
  createHacpHandler,
  createHacpRequest,
  verifyHacpRequest,
} from "@ahi-lab-hacp/http";
```

The binding sends an ActionEnvelope using `application/hacp+json` and `HACP-Version: 0.1`. The server API requires an independently authenticated agent identity and delegates protocol verification to `@ahi-lab-hacp/core`.

See [HTTP binding guidance](../../docs/http-binding.md) and the [complete example](../../examples/basic/src/index.ts).
