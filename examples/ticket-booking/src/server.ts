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
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#000;font:18px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(1120px,calc(100% - 48px));margin:0 auto;padding:64px 0 80px}
    header{border-bottom:2px solid #000;padding-bottom:34px;margin-bottom:42px}
    .eyebrow,.label{font:700 12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
    h1{max-width:950px;margin:16px 0 20px;font-size:clamp(42px,7vw,78px);line-height:.98;letter-spacing:-.05em}
    h2{font-size:clamp(28px,4vw,42px);line-height:1.05;letter-spacing:-.035em;margin:0 0 12px}
    h3{font-size:21px;line-height:1.2;margin:0 0 16px}
    header p,.section-intro{max-width:820px;margin:0;font-size:21px}
    .flow{display:grid;grid-template-columns:repeat(4,1fr);border:2px solid #000;margin:38px 0}
    .flow div{padding:22px;border-right:1px solid #000}
    .flow div:last-child{border:0}
    .flow b,.flow span{display:block}
    .flow span{margin-bottom:10px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace}
    .actions{display:flex;gap:12px;align-items:center;margin:30px 0 38px;flex-wrap:wrap}
    button,a.link{appearance:none;border:2px solid #000;background:#000;color:#fff;padding:13px 18px;font:700 14px ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;cursor:pointer}
    a.link{background:#fff;color:#000}
    button:disabled{opacity:.45;cursor:wait}
    .empty{padding:38px 0;border-block:2px solid #000}
    .demo{border-top:2px solid #000;padding-top:38px}
    .scenario-nav{display:flex;gap:8px;overflow:auto;padding:2px 2px 14px;margin:24px -2px 8px}
    .scenario-button{flex:0 0 auto;background:#fff;color:#000;border-width:1px;max-width:220px;text-align:left;line-height:1.3}
    .scenario-button[aria-selected="true"]{background:#000;color:#fff}
    .comparison{display:grid;grid-template-columns:1fr 1fr;margin-top:22px;border:2px solid #000}
    .panel{padding:26px;min-height:260px}
    .panel+ .panel{border-left:2px solid #000}
    .facts{list-style:none;padding:0;margin:20px 0 0}
    .facts li{display:flex;justify-content:space-between;gap:20px;padding:9px 0;border-top:1px solid #000}
    .facts strong{text-align:right}
    .verdict-banner{display:flex;justify-content:space-between;gap:22px;align-items:center;background:#000;color:#fff;padding:23px 26px;border:2px solid #000;border-top:0}
    .verdict-word{font-size:34px;font-weight:900;letter-spacing:-.03em}
    .verdict-reason{font:700 13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right}
    .under-hood{margin-top:64px;padding-top:40px;border-top:2px solid #000}
    .trace{display:grid;grid-template-columns:repeat(7,1fr);border:2px solid #000;margin:28px 0 38px}
    .trace-step{position:relative;padding:17px 12px;min-height:124px;border-right:1px solid #000}
    .trace-step:last-child{border:0}
    .trace-step b,.trace-step span{display:block}
    .trace-step span{font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:8px}
    .trace-step b{font-size:14px;line-height:1.3}
    .trace-step[data-state="fail"]{background:#000;color:#fff}
    .trace-step[data-state="skip"]{color:#666;background:repeating-linear-gradient(-45deg,#fff,#fff 5px,#eee 5px,#eee 6px)}
    .artifact-grid{display:grid;grid-template-columns:260px minmax(0,1fr);border:2px solid #000}
    .artifact-nav{border-right:2px solid #000}
    .artifact-button{display:block;width:100%;background:#fff;color:#000;border:0;border-bottom:1px solid #000;text-align:left;padding:17px}
    .artifact-button:last-child{border-bottom:0}
    .artifact-button[aria-selected="true"]{background:#000;color:#fff}
    .artifact-view{min-width:0}
    .artifact-heading{padding:20px 22px;border-bottom:1px solid #000}
    .artifact-heading p{margin:7px 0 0;max-width:740px}
    pre{overflow:auto;margin:0;padding:24px;background:#fff;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;min-height:420px;white-space:pre-wrap;word-break:break-word}
    .legend{display:flex;gap:20px;flex-wrap:wrap;margin:16px 0 0;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace}
    .legend span:before{display:inline-block;width:11px;height:11px;margin-right:7px;border:1px solid #000;content:""}
    .legend .fail:before{background:#000}
    .legend .skip:before{background:repeating-linear-gradient(-45deg,#fff,#fff 2px,#000 2px,#000 3px)}
    footer{margin-top:54px;padding-top:20px;border-top:1px solid #000;font-size:15px}
    [hidden]{display:none!important}
    @media(max-width:900px){.trace{grid-template-columns:repeat(2,1fr)}.trace-step{border-bottom:1px solid #000}.artifact-grid{grid-template-columns:1fr}.artifact-nav{border-right:0;border-bottom:2px solid #000;display:grid;grid-template-columns:repeat(3,1fr)}.artifact-button{border-right:1px solid #000}.artifact-button:nth-child(3n){border-right:0}}
    @media(max-width:760px){main{width:min(100% - 24px,1120px);padding-top:36px}.flow,.comparison{grid-template-columns:1fr}.flow div{border-right:0;border-bottom:1px solid #000}.flow div:last-child{border-bottom:0}.panel+ .panel{border-left:0;border-top:2px solid #000}.verdict-banner{display:block}.verdict-reason{text-align:left;margin-top:8px}.artifact-nav{grid-template-columns:1fr 1fr}.artifact-button:nth-child(3n){border-right:1px solid #000}.artifact-button:nth-child(2n){border-right:0}pre{font-size:12px;padding:16px;min-height:320px}}
  </style>
</head>
<body><main>
  <header><div class="eyebrow">HACP 0.1 · Live protocol demonstration</div><h1>See what the ticket website actually verifies.</h1><p>A legitimate agent identity is not enough. Follow a human-approved booking from natural language to signed Decision, delegated Mandate, HTTP action, independent verification, and final Receipt.</p></header>
  <section class="flow" aria-label="HACP flow"><div><span>01 · HUMAN</span><b>Alice approves one NYC ticket, Friday afternoon, maximum USD 600.</b></div><div><span>02 · AUTHORITY</span><b>The reviewed Decision and bounded Mandate are signed.</b></div><div><span>03 · AGENT</span><b>The travel agent signs the exact booking action.</b></div><div><span>04 · RECEIVER</span><b>The ticket API verifies intent and independently returns ALLOW or DENY.</b></div></section>
  <div class="actions"><button id="run" type="button">Create and verify signed requests</button><a class="link" href="/.well-known/hacp.json">Inspect public keys</a></div>
  <section id="loading" class="empty" aria-live="polite">Start the demonstration. The first view will show the valid $542 booking; then you can introduce an attacker, change the price or quantity, tamper with the signed action, or replay it.</section>
  <section id="demo" class="demo" hidden aria-live="polite">
    <div class="eyebrow">Interactive comparison</div>
    <h2>Human authorization vs. agent action</h2>
    <p class="section-intro">Choose a request. The left side never changes because it is what Alice signed. The right side is what reaches the ticket website.</p>
    <div id="scenarios" class="scenario-nav" role="tablist" aria-label="Verification scenarios"></div>
    <div class="comparison">
      <article class="panel"><div class="label">Signed human Decision</div><h3>What Alice authorized</h3><ul id="human-facts" class="facts"></ul></article>
      <article class="panel"><div class="label">Authenticated HTTP action</div><h3>What the agent requested</h3><ul id="action-facts" class="facts"></ul></article>
    </div>
    <div class="verdict-banner"><div id="verdict" class="verdict-word"></div><div id="reason" class="verdict-reason"></div></div>

    <section class="under-hood">
      <div class="eyebrow">Under the hood</div>
      <h2>Six verification gates and a signed result</h2>
      <p class="section-intro">The ticket server resolves the signed provenance chain, binds it to the authenticated agent, checks the exact requested intent, consumes the one-time nonce, and signs its result.</p>
      <div id="trace" class="trace" aria-label="Server verification trace"></div>
      <div class="legend"><span>Passed</span><span class="fail">Rejected here</span><span class="skip">Not evaluated after rejection</span></div>
      <div class="artifact-grid">
        <nav id="artifact-nav" class="artifact-nav" aria-label="Protocol artifacts"></nav>
        <section class="artifact-view">
          <div class="artifact-heading"><div id="artifact-label" class="label"></div><h3 id="artifact-title"></h3><p id="artifact-description"></p></div>
          <pre id="artifact-json"></pre>
        </section>
      </div>
    </section>
  </section>
  <footer>This is a cryptographic reference demonstration. It does not purchase a real ticket. The human, agent, and verifier use ephemeral demonstration keys, and every result includes a verifier-signed Receipt.</footer>
</main>
<script>
const button=document.getElementById('run');
const loading=document.getElementById('loading');
const demo=document.getElementById('demo');
const scenarios=document.getElementById('scenarios');
const trace=document.getElementById('trace');
const artifactNav=document.getElementById('artifact-nav');
const artifactJson=document.getElementById('artifact-json');
let run;
let selectedOutcome=0;
let selectedArtifact=0;

const scenarioOrder=['authorized booking','quantity exceeds human intent','price exceeds human limit','wrong authenticated agent','action changed after signing','same action replayed'];
const scenarioLabels={
  'authorized booking':'Valid booking',
  'quantity exceeds human intent':'Attacker: 100 tickets',
  'price exceeds human limit':'Agent: $700 ticket',
  'wrong authenticated agent':'Wrong agent identity',
  'action changed after signing':'Tampered request',
  'same action replayed':'Replayed request'
};
const failureGate={
  AGENT_AUTHENTICATION_FAILED:2,
  ACTION_SIGNATURE_INVALID:3,
  'CONSTRAINT_VIOLATION:maxAmount':4,
  'INTENT_PARAMETER_MISMATCH:quantity':4,
  REPLAY_DETECTED:5
};

function text(id,value){document.getElementById(id).textContent=value;}
function fact(label,value){const item=document.createElement('li');const name=document.createElement('span');const strong=document.createElement('strong');name.textContent=label;strong.textContent=value;item.append(name,strong);return item;}
function valueAt(object,path,fallback='—'){let value=object;for(const key of path){value=value?.[key];}return value===undefined||value===null?fallback:String(value);}
function short(value){const string=String(value);return string.length>38?string.slice(0,18)+'…'+string.slice(-12):string;}
function formatMoney(amount){return amount?amount.currency+' '+amount.value:'—';}

function failedAt(outcome){for(const code of outcome.reasonCodes){if(failureGate[code]!==undefined)return failureGate[code];}return outcome.verdict==='DENY'?4:-1;}

function verificationTrace(outcome){
  const failed=failedAt(outcome);
  const failureDescriptions={
    AGENT_AUTHENTICATION_FAILED:'Caller does not match agent',
    ACTION_SIGNATURE_INVALID:'Signed action was modified',
    'CONSTRAINT_VIOLATION:maxAmount':'USD 700 exceeds USD 600',
    'INTENT_PARAMETER_MISMATCH:quantity':'100 does not match signed 1',
    REPLAY_DETECTED:'Nonce was already consumed'
  };
  const failureDescription=failureDescriptions[outcome.reasonCodes[0]]??outcome.reasonCodes[0];
  const steps=[
    ['01','Decision proof','Human signature'],
    ['02','Mandate chain','Agent delegation'],
    ['03','Agent identity','HTTP authentication'],
    ['04','Action proof','Exact bytes signed'],
    ['05','Intent + limits','Meaning matches'],
    ['06','Replay nonce','One use only'],
    ['07','Signed Receipt','Auditable result']
  ];
  trace.replaceChildren();
  steps.forEach((step,index)=>{
    const node=document.createElement('div');node.className='trace-step';
    const state=failed===index?'fail':failed>=0&&index>failed&&index<6?'skip':'pass';node.dataset.state=state;
    const number=document.createElement('span');number.textContent=step[0]+' · '+(state==='fail'?'REJECT':state==='skip'?'NOT RUN':'PASS');
    const label=document.createElement('b');label.textContent=step[1];
    const detail=document.createElement('small');detail.textContent=state==='fail'?failureDescription:step[2];
    node.append(number,label,detail);trace.append(node);
  });
}

function checkReport(outcome){
  const failed=failedAt(outcome);
  const names=['decisionSignature','mandateDelegation','agentIdentity','actionSignature','intentAndConstraints','freshNonce','ticketPolicy'];
  return {
    authenticatedTransportIdentity:outcome.authenticatedAs,
    claimedAgent:outcome.envelope.agent,
    checks:Object.fromEntries(names.map((name,index)=>[name,failed===index?'FAIL':failed>=0&&index>failed?'NOT_EVALUATED':'PASS'])),
    verdict:outcome.verdict,
    reasonCodes:outcome.reasonCodes,
    receiptSignatureValid:outcome.receiptSignatureValid
  };
}

function artifacts(outcome){
  return [
    {label:'01 · SOURCE',title:'Human communication',description:'Natural language is evidence, not authority. HACP first extracts a proposed structured Decision for Alice to review.',value:{communication:run.communication,source:'urn:demo:chat:alice:message-1',status:'PROPOSAL — cannot authorize an action'}},
    {label:'02 · DECISION',title:'Human-signed Decision',description:'Alice approves this bounded intent. The proof binds her identity to the destination, time, quantity, price, and target API.',value:run.decision},
    {label:'03 · MANDATE',title:'Delegation to the agent',description:'The Mandate names the authorized agent, permitted action, receiving website, limits, expiration, and delegation depth.',value:run.mandate},
    {label:'04 · HTTP',title:'Authenticated action request',description:'Authentication identifies the caller. The HACP Action Envelope separately carries the signed human provenance and exact requested action. This demo uses an identity string as the illustrative bearer credential; production uses OAuth, mTLS, or workload identity.',value:{method:'POST',url:outcome.envelope.action.target,headers:{authorization:'Bearer '+outcome.authenticatedAs,'content-type':'application/hacp+json'},body:outcome.envelope}},
    {label:'05 · VERIFY',title:'Server-side verification',description:'A readable view reconstructed from the request and signed Receipt: the receiver resolves public keys and provenance objects, compares identity and intent, enforces constraints, and consumes the nonce.',value:checkReport(outcome)},
    {label:'06 · RECEIPT',title:'Verifier-signed result',description:'ALLOW and DENY results are signed by the ticket server so the decision can be audited independently.',value:outcome.receipt}
  ];
}

function renderArtifact(outcome){
  const list=artifacts(outcome);const artifact=list[selectedArtifact]??list[0];
  [...artifactNav.children].forEach((node,index)=>node.setAttribute('aria-selected',String(index===selectedArtifact)));
  text('artifact-label',artifact.label);text('artifact-title',artifact.title);text('artifact-description',artifact.description);
  artifactJson.textContent=JSON.stringify(artifact.value,null,2);
}

function buildArtifactNav(){
  artifactNav.replaceChildren();
  artifacts(run.outcomes[0]).forEach((artifact,index)=>{const item=document.createElement('button');item.type='button';item.className='artifact-button';item.textContent=artifact.label.replace(' · ',' — ');item.setAttribute('aria-selected',String(index===selectedArtifact));item.addEventListener('click',()=>{selectedArtifact=index;renderArtifact(run.outcomes[selectedOutcome]);});artifactNav.append(item);});
}

function renderOutcome(){
  const outcome=run.outcomes[selectedOutcome];const action=outcome.envelope.action;const parameters=action.parameters;
  [...scenarios.children].forEach(node=>node.setAttribute('aria-selected',String(Number(node.dataset.outcomeIndex)===selectedOutcome)));
  const humanFacts=document.getElementById('human-facts');humanFacts.replaceChildren(
    fact('Principal',short(run.principal)),fact('Destination','NYC'),fact('Departure','Friday afternoon'),fact('Quantity','1 ticket'),fact('Maximum','USD 600.00'),fact('Authorized agent',short(run.agent))
  );
  const actionFacts=document.getElementById('action-facts');actionFacts.replaceChildren(
    fact('Authenticated as',short(outcome.authenticatedAs)),fact('Destination',valueAt(parameters,['destination'])),fact('Departure',valueAt(parameters,['departureWindow'])),fact('Quantity',valueAt(parameters,['quantity'])+' ticket'+(parameters.quantity===1?'':'s')),fact('Price',formatMoney(parameters.amount)),fact('Action signature',outcome.reasonCodes.includes('ACTION_SIGNATURE_INVALID')?'INVALID':'valid')
  );
  text('verdict',outcome.verdict==='ALLOW'?'ALLOW — booking may proceed':'DENY — no booking created');
  text('reason',outcome.verdict==='ALLOW'?'Identity, signature, intent, constraints and nonce all passed.':outcome.reasonCodes.join(' · '));
  verificationTrace(outcome);renderArtifact(outcome);
}

function buildScenarios(){
  scenarios.replaceChildren();
  scenarioOrder.forEach(name=>{const index=run.outcomes.findIndex(item=>item.name===name);if(index<0)return;const item=document.createElement('button');item.type='button';item.className='scenario-button';item.dataset.outcomeIndex=String(index);item.textContent=scenarioLabels[name]??name;item.setAttribute('role','tab');item.setAttribute('aria-selected',String(index===selectedOutcome));item.addEventListener('click',()=>{selectedOutcome=index;renderOutcome();});scenarios.append(item);});
}

button.addEventListener('click',async()=>{
  button.disabled=true;button.textContent='Signing and verifying…';loading.textContent='Creating a proposed Decision, applying the human signature, issuing the Mandate, signing each Action Envelope, and asking the ticket server to verify them…';
  try{
    const response=await fetch('/api/demo',{method:'POST'});if(!response.ok)throw new Error('Demo request failed: '+response.status);run=await response.json();
    selectedOutcome=run.outcomes.findIndex(item=>item.name==='authorized booking');if(selectedOutcome<0)selectedOutcome=0;selectedArtifact=0;
    loading.hidden=true;demo.hidden=false;buildScenarios();buildArtifactNav();renderOutcome();demo.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){loading.hidden=false;loading.textContent=error instanceof Error?error.message:String(error);}
  finally{button.disabled=false;button.textContent='Generate a fresh signed run';}
});
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

    if (request.method === "GET" && url.pathname === "/api/health") {
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
