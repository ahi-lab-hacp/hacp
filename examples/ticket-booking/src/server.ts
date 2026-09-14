import { createServer, type ServerResponse } from "node:http";
import { createHacpDiscoveryResponse } from "@ahi-lab-hacp/http";
import { createTicketBookingDemoKeys, runTicketBookingDemo } from "./demo.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const configuredOrigin = process.env.HACP_DEMO_ORIGIN?.replace(/\/$/, "");
const keys = createTicketBookingDemoKeys();

const securityHeaders = {
  "content-security-policy":
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function page(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HACP Ticket Booking Interoperability Demo</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font:17px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(1040px,calc(100% - 40px));margin:0 auto;padding:64px 0 80px}header{border-bottom:2px solid #000;padding-bottom:32px;margin-bottom:40px}.eyebrow{font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase}h1{max-width:850px;margin:16px 0 18px;font-size:clamp(40px,7vw,78px);line-height:.96;letter-spacing:-.055em}header p{max-width:760px;margin:0;font-size:20px}.flow{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #000;margin:36px 0}.flow div{padding:20px;border-right:1px solid #000}.flow div:last-child{border:0}.flow b,.flow span{display:block}.flow span{margin-bottom:8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace}.actions{display:flex;gap:12px;align-items:center;margin:30px 0}button,a.link{appearance:none;border:1px solid #000;background:#000;color:#fff;padding:13px 18px;font:700 14px ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;cursor:pointer}a.link{background:#fff;color:#000}button:disabled{opacity:.45;cursor:wait}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:14px 12px;border-bottom:1px solid #000;text-align:left;vertical-align:top}th{font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em}.verdict{font-weight:800}.empty{padding:36px 0;border-block:1px solid #000;color:#444}details{margin-top:32px;border:1px solid #000;padding:16px}summary{cursor:pointer;font-weight:700}pre{overflow:auto;margin:16px 0 0;padding:18px;background:#f5f5f5;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}footer{margin-top:48px;padding-top:18px;border-top:1px solid #000;font-size:14px}@media(max-width:760px){main{width:min(100% - 24px,1040px);padding-top:36px}.flow{grid-template-columns:1fr}.flow div{border-right:0;border-bottom:1px solid #000}table,thead,tbody,tr,th,td{display:block}thead{display:none}tr{border-bottom:1px solid #000;padding:10px 0}td{border:0;padding:5px 0}td:before{content:attr(data-label) ": ";font-weight:700}}
  </style>
</head>
<body><main>
  <header><div class="eyebrow">HACP 0.1 · Live reference demonstration</div><h1>Can this agent book the ticket?</h1><p>The receiver verifies the human decision, delegated mandate, authenticated agent, exact action, price limit, signature and replay nonce before creating a simulated booking.</p></header>
  <section class="flow" aria-label="HACP flow"><div><span>01 · HUMAN</span><b>Alice approves NYC, Friday afternoon, maximum USD 600.</b></div><div><span>02 · AUTHORITY</span><b>The reviewed Decision and bounded Mandate are signed.</b></div><div><span>03 · AGENT</span><b>The travel agent signs the exact booking action.</b></div><div><span>04 · RECEIVER</span><b>The ticket API independently returns ALLOW or DENY.</b></div></section>
  <div class="actions"><button id="run" type="button">Run five verification cases</button><a class="link" href="/.well-known/hacp.json">Public keys</a></div>
  <section id="result" class="empty" aria-live="polite">Run the demonstration to compare an authorized request with wrong-identity, over-budget, tampered and replayed requests.</section>
  <details id="artifacts" hidden><summary>Inspect the complete signed artifacts</summary><pre id="json"></pre></details>
  <footer>No real ticket is purchased. Every case returns a verifier-signed Receipt that can be checked against the published public key.</footer>
</main>
<script>
const button=document.getElementById('run');const result=document.getElementById('result');const details=document.getElementById('artifacts');const json=document.getElementById('json');
button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Verifying…';result.className='empty';result.textContent='Creating signed Decision, Mandate and Action Envelopes…';details.hidden=true;try{const response=await fetch('/api/demo',{method:'POST'});if(!response.ok)throw new Error('Demo request failed: '+response.status);const data=await response.json();const rows=data.outcomes.map(item=>'<tr><td data-label="Scenario"></td><td data-label="HTTP"></td><td data-label="Verdict" class="verdict"></td><td data-label="Reason"></td><td data-label="Receipt"></td></tr>');result.className='';result.innerHTML='<table><thead><tr><th>Scenario</th><th>HTTP</th><th>Verdict</th><th>Reason</th><th>Receipt</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';[...result.querySelectorAll('tbody tr')].forEach((row,index)=>{const item=data.outcomes[index];const cells=row.children;cells[0].textContent=item.name;cells[1].textContent=String(item.status);cells[2].textContent=item.verdict;cells[3].textContent=item.reasonCodes.join(', ');cells[4].textContent=item.receiptSignatureValid?'valid signature':'invalid';});json.textContent=JSON.stringify(data,null,2);details.hidden=false;}catch(error){result.className='empty';result.textContent=error instanceof Error?error.message:String(error);}finally{button.disabled=false;button.textContent='Run five verification cases';}});
</script></body></html>`;
}

async function sendFetchResponse(response: Response, target: ServerResponse): Promise<void> {
  target.statusCode = response.status;
  for (const [name, value] of response.headers) target.setHeader(name, value);
  for (const [name, value] of Object.entries(securityHeaders)) target.setHeader(name, value);
  target.end(Buffer.from(await response.arrayBuffer()));
}

const server = createServer(async (request, response) => {
  const origin = configuredOrigin ?? `http://${request.headers.host ?? `127.0.0.1:${port}`}`;
  const url = new URL(request.url ?? "/", origin);

  try {
    if (request.method === "GET" && url.pathname === "/") {
      await sendFetchResponse(
        new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } }),
        response,
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      await sendFetchResponse(Response.json({ status: "ok", hacpVersion: "0.1" }), response);
      return;
    }

    const identities = {
      human: `${origin}/principals/alice`,
      organization: `${origin}/organizations/example-travel`,
      agent: `${origin}/agents/travel`,
      verifier: `${origin}/hacp/verifier`,
    };
    const demo = await runTicketBookingDemo({ ticketApi: origin, keys, ...identities });

    if (request.method === "GET" && url.pathname === "/.well-known/hacp.json") {
      await sendFetchResponse(createHacpDiscoveryResponse(demo.discovery), response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/demo") {
      await sendFetchResponse(
        Response.json(demo, {
          headers: { "cache-control": "no-store", "content-type": "application/hacp+json" },
        }),
        response,
      );
      return;
    }

    await sendFetchResponse(Response.json({ error: "Not found" }, { status: 404 }), response);
  } catch {
    await sendFetchResponse(
      Response.json(
        { error: "The verification demonstration could not be completed." },
        { status: 500 },
      ),
      response,
    );
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`HACP ticket-booking demo listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
