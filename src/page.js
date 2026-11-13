// The setup page your memory shows at its own web address.
// Self-contained: no outside scripts, fonts or trackers.

export const SETUP_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='266 119 490 490'%3E%3Cpath fill='%235ce6f2' fill-rule='evenodd' d='M494 131 L544 133 L589 144 L627 162 L665 189 L692 217 L717 254 L736 300 L745 349 L744 393 L734 438 L713 484 L686 521 L656 549 L638 562 L613 576 L562 593 L528 597 L488 597 L443 588 L421 580 L395 567 L362 544 L327 508 L304 472 L288 433 L279 388 L279 341 L288 297 L308 250 L333 214 L364 183 L405 156 L427 146 L455 137ZM498 150 L462 155 L426 167 L384 191 L352 220 L324 259 L308 295 L298 337 L297 381 L304 421 L318 459 L338 492 L370 527 L406 552 L442 568 L463 574 L488 578 L525 578 L561 574 L601 561 L639 539 L675 506 L700 470 L712 445 L720 422 L726 389 L726 343 L718 304 L700 261 L674 224 L653 203 L623 181 L583 162 L542 152ZM511 193 L528 205 L542 219 L642 302 L687 444 L681 461 L660 489 L646 501 L639 498 L597 465 L562 358 L512 319 L462 358 L425 465 L382 499 L377 501 L357 482 L348 470 L336 447 L382 301ZM511 246 L409 329 L368 460 L404 434 L435 336 L496 288 L507 280 L513 279 L516 279 L524 285 L588 336 L618 433 L648 456 L654 460 L655 458 L615 331ZM510 379 L515 380 L560 410 L572 445 L571 447 L513 407 L510 407 L501 415 L451 447 L463 409Z'/%3E%3C/svg%3E">
<title>Your Memory</title>
<style>
/* ThronOS look: deep blue-black, a faint light field, a fine grid that fades out, light on hairline edges. */
:root { --bg:#04070a; --text:#dcebee; --muted:#93abb0; --c:#8fdbe3; --hi:#ecfcfe; --line:rgba(150,210,220,.13); --line2:rgba(150,210,220,.26); --bad:#f0717f; --ok:#7fe0c0; --glow:0 0 12px rgba(143,219,227,.45);
  --sans:"Segoe UI Variable Text","Segoe UI",-apple-system,"SF Pro Text",Inter,system-ui,sans-serif; --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; color-scheme:dark; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 var(--sans); }
body::before { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
  background: radial-gradient(1100px 520px at 72% -12%, rgba(90,180,200,.11), transparent 70%),
    linear-gradient(rgba(143,219,227,.035) 1px, transparent 1px) 0 0 / 56px 56px,
    linear-gradient(90deg, rgba(143,219,227,.035) 1px, transparent 1px) 0 0 / 56px 56px;
  -webkit-mask-image:linear-gradient(#000, rgba(0,0,0,.35) 45%, transparent 85%); mask-image:linear-gradient(#000, rgba(0,0,0,.35) 45%, transparent 85%); }
main { max-width:660px; margin:0 auto; padding:40px 16px 64px; }
.brand { display:flex; align-items:center; gap:14px; padding-bottom:16px; border-bottom:1px solid var(--line); position:relative; margin-bottom:10px; }
.brand::after { content:""; position:absolute; left:0; bottom:-1px; width:72px; height:1px; background:var(--c); box-shadow:var(--glow); }
.brand svg { width:40px; height:40px; flex:none; }
h1 { font-weight:300; font-size:26px; letter-spacing:.14em; text-transform:uppercase; color:var(--hi); margin:0; }
h2 { font-size:18px; font-weight:600; letter-spacing:.02em; margin:0 0 10px; color:var(--hi); }
p { margin:0 0 12px; }
.muted { color:var(--muted); }
.card { position:relative; border:1px solid var(--line); border-radius:4px; padding:20px; margin:18px 0; background:linear-gradient(180deg, rgba(143,219,227,.04), rgba(143,219,227,.012)); }
.card::before { content:""; position:absolute; left:14px; top:-1px; width:48px; height:1px; background:linear-gradient(90deg, var(--c), transparent); box-shadow:var(--glow); }
label { display:block; font-weight:600; margin-bottom:6px; }
input[type=password], input[type=text] { width:100%; font:inherit; padding:11px 13px; border:1px solid var(--line2); border-radius:4px; background:rgba(0,0,0,.3); color:var(--text); }
input:focus { outline:none; border-color:var(--c); box-shadow:0 0 0 1px rgba(143,219,227,.35), var(--glow); }
button { font:500 15px var(--sans); border-radius:4px; padding:10px 16px; min-height:40px; cursor:pointer; background:rgba(143,219,227,.14); border:1px solid rgba(143,219,227,.7); color:var(--hi); transition:background .15s, box-shadow .15s; }
button:hover { background:rgba(143,219,227,.22); box-shadow:var(--glow); }
button.secondary { background:transparent; color:var(--text); border-color:var(--line2); }
button.secondary:hover { border-color:var(--c); box-shadow:none; }
.row { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.error { color:var(--bad); margin-top:10px; min-height:1em; }
.done { color:var(--ok); font-weight:600; margin-top:10px; }
.link { font:14px var(--mono); word-break:break-all; background:rgba(0,0,0,.3); border:1px solid var(--line2); border-radius:4px; padding:12px; color:var(--c); }
ol { padding-left:22px; margin:0 0 8px; } li { margin:4px 0; }
b { color:var(--hi); font-weight:600; }
.tabs { display:flex; gap:2px; flex-wrap:wrap; margin-bottom:14px; border:1px solid var(--line); border-radius:6px; padding:3px; background:rgba(0,0,0,.25); width:fit-content; max-width:100%; }
.tabs button { background:transparent; border:0; color:var(--muted); min-height:32px; padding:0 12px; box-shadow:none; }
.tabs button[aria-selected=true] { background:rgba(143,219,227,.12); color:var(--hi); box-shadow:inset 0 -1px 0 var(--c); }
code { font:13px var(--mono); background:rgba(0,0,0,.3); padding:1px 5px; border-radius:3px; color:var(--c); }
pre { white-space:pre-wrap; word-break:break-all; background:rgba(0,0,0,.3); border:1px solid var(--line); border-radius:4px; padding:12px; font:12.5px/1.5 var(--mono); color:var(--text); }
[hidden] { display:none !important; }
a { color:var(--c); }
.foot { font-size:13px; color:var(--muted); border-top:1px solid var(--line); padding-top:14px; margin-top:28px; }
</style>
</head>
<body>
<main>
  <div class="brand"><svg viewBox="266 119 490 490" aria-hidden="true"><path fill="#5ce6f2" fill-rule="evenodd" d="M494 131 L544 133 L589 144 L627 162 L665 189 L692 217 L717 254 L736 300 L745 349 L744 393 L734 438 L713 484 L686 521 L656 549 L638 562 L613 576 L562 593 L528 597 L488 597 L443 588 L421 580 L395 567 L362 544 L327 508 L304 472 L288 433 L279 388 L279 341 L288 297 L308 250 L333 214 L364 183 L405 156 L427 146 L455 137ZM498 150 L462 155 L426 167 L384 191 L352 220 L324 259 L308 295 L298 337 L297 381 L304 421 L318 459 L338 492 L370 527 L406 552 L442 568 L463 574 L488 578 L525 578 L561 574 L601 561 L639 539 L675 506 L700 470 L712 445 L720 422 L726 389 L726 343 L718 304 L700 261 L674 224 L653 203 L623 181 L583 162 L542 152ZM511 193 L528 205 L542 219 L642 302 L687 444 L681 461 L660 489 L646 501 L639 498 L597 465 L562 358 L512 319 L462 358 L425 465 L382 499 L377 501 L357 482 L348 470 L336 447 L382 301ZM511 246 L409 329 L368 460 L404 434 L435 336 L496 288 L507 280 L513 279 L516 279 L524 285 L588 336 L618 433 L648 456 L654 460 L655 458 L615 331ZM510 379 L515 380 L560 410 L572 445 L571 447 L513 407 L510 407 L501 415 L451 447 L463 409Z"/></svg><h1>Your Memory</h1></div>
  <p class="muted">One private memory for all your AI apps: ChatGPT, Claude, Cursor, Gemini CLI and any app that supports MCP (a standard way for AI apps to use tools).</p>

  <section class="card" id="step-password">
    <h2 id="pw-title">Step 1: Enter your password</h2>
    <p id="pw-help" class="muted">This is the password you picked when you set this up on Cloudflare.</p>
    <form id="pw-form">
      <label for="pw">Password</label>
      <input id="pw" type="password" autocomplete="current-password" required>
      <div class="row"><button type="submit" id="pw-button">Continue</button></div>
      <div class="error" id="pw-error" role="alert"></div>
    </form>
    <p id="forgot-open" hidden style="margin-top:14px"><a href="#" id="forgot-link">I forgot my password</a></p>
    <div id="forgot" hidden>
      <p style="margin-top:14px"><b>Start over with a new password.</b> Your memory is locked with your old password, so starting over <b>erases everything in it</b>.</p>
      <ol>
        <li>In Cloudflare, open this Worker, go to <b>Settings</b>, <b>Variables and Secrets</b>, and change <code>MEMORY_PASSWORD</code> to a new password.</li>
        <li>Type the new password above, type <b>ERASE</b> below, and click <b>Start over</b>.</li>
      </ol>
      <label for="erase">Type ERASE to confirm</label>
      <input id="erase" type="text" autocomplete="off">
      <div class="row"><button class="secondary" id="reset">Start over</button></div>
    </div>
  </section>

  <section class="card" id="step-link" hidden>
    <h2>Step 2: Copy your private link</h2>
    <p>This link is the key to your memory. Keep it private, like a password. Only paste it into your AI apps' settings, never into a chat.</p>
    <div class="link" id="link-box">••••••••••••••••••••••••</div>
    <div class="row">
      <button id="copy">Copy link</button>
      <button class="secondary" id="reveal">Show it</button>
    </div>
    <p class="done" id="copied" hidden>Copied.</p>
  </section>

  <section class="card" id="step-apps" hidden>
    <h2>Step 3: Add it to your AI apps</h2>
    <p class="muted">Do this once per app. On phones, it carries over from the website of the same app.</p>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="claude" aria-selected="true">Claude</button>
      <button role="tab" data-tab="chatgpt" aria-selected="false">ChatGPT</button>
      <button role="tab" data-tab="code" aria-selected="false">Coding apps</button>
      <button role="tab" data-tab="other" aria-selected="false">Other apps</button>
    </div>
    <div data-panel="claude">
      <ol>
        <li>Open <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer">claude.ai Settings, Connectors</a> on a computer.</li>
        <li>Click <b>Add custom connector</b>.</li>
        <li>Name: <b>Memory</b>. URL: paste your link. Click <b>Add</b>.</li>
        <li>That's it. It now works in Claude on the web, the desktop app and your phone.</li>
      </ol>
    </div>
    <div data-panel="chatgpt" hidden>
      <ol>
        <li>Open ChatGPT on a computer and go to <b>Settings</b>, then <b>Apps &amp; Connectors</b>.</li>
        <li>Under <b>Advanced settings</b>, turn on <b>Developer mode</b>. (Some plans do not have it yet.)</li>
        <li>Click <b>Create</b>. Name: <b>Memory</b>. MCP server URL: paste your link. Authentication: <b>No authentication</b>.</li>
        <li>Confirm and click <b>Create</b>. In a chat, turn Memory on from the <b>+</b> menu.</li>
      </ol>
      <p class="muted">Menu names change from time to time; look for "Connectors" or "Apps".</p>
    </div>
    <div data-panel="code" hidden>
      <p>Most coding apps (Cursor, VS Code, Windsurf and others) accept this in their MCP settings file:</p>
      <pre id="snippet-json"></pre>
      <p>Command-line agents:</p>
      <pre id="snippet-cli"></pre>
    </div>
    <div data-panel="other" hidden>
      <ol>
        <li>Open the app's settings and look for <b>Connectors</b>, <b>Integrations</b>, <b>Tools</b> or <b>MCP</b>.</li>
        <li>Choose to add a custom or remote server, and paste your link.</li>
        <li>If it asks about sign-in or authentication, choose <b>None</b>.</li>
      </ol>
    </div>
  </section>

  <section class="card" id="step-try" hidden>
    <h2>Step 4: Try it</h2>
    <p>In any connected app, say: <b>"Remember that my favorite color is green."</b> Then, in a different app or on your phone, ask: <b>"What's my favorite color?"</b></p>
    <p class="muted">Optional: add the <a href="https://github.com/jacobbarglof/thron-memory/raw/main/thron-memory-skill.zip" rel="noopener noreferrer">thron-memory skill</a> in Claude (Customize, Skills, Upload) so it uses memory even more smoothly.</p>
  </section>

  <section class="card" id="step-extra" hidden>
    <h2>Your memory, your copy</h2>
    <div class="row"><button class="secondary" id="download">Download a copy of my memory</button></div>
    <p class="muted" style="margin-top:14px">Extra privacy (optional): in Cloudflare, open this Worker, go to Settings, Variables and Secrets, and delete <code>MEMORY_PASSWORD</code>. Your password still opens this page, and Cloudflare no longer holds anything that can unlock your memory.</p>
  </section>

  <p class="foot">Your memory lives only in your own Cloudflare account, encrypted. <a href="https://github.com/jacobbarglof/thron-memory" rel="noopener noreferrer">thron-memory</a> is open source and part of ThronOS.</p>
</main>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var link = "";
  var claimed = false;

  function post(path, body) {
    return fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (d) { d._status = r.status; return d; }); });
  }

  post("/api/state").then(function (s) {
    claimed = s.claimed;
    if (s.cli) {
      $("pw-title").textContent = "This memory was set up from the command line";
      $("pw-help").textContent = "To see your link, run this on the computer you set it up from: npx -y thron-memory url";
      $("pw-form").hidden = true;
    } else if (!s.claimed) {
      $("pw-title").textContent = "Step 1: Create your memory";
      $("pw-help").textContent = "Enter the password you picked on Cloudflare. This creates your private link.";
      $("pw-button").textContent = "Create my memory";
    } else {
      $("pw-button").textContent = "Show my link";
      $("forgot-open").hidden = false;
    }
  });

  $("forgot-link").addEventListener("click", function (e) {
    e.preventDefault();
    $("forgot").hidden = false;
    $("forgot-open").hidden = true;
  });
  $("reset").addEventListener("click", function () {
    $("pw-error").textContent = "";
    post("/api/reset", { password: $("pw").value, confirm: $("erase").value.trim() }).then(show);
  });

  $("pw-form").addEventListener("submit", function (e) {
    e.preventDefault();
    $("pw-error").textContent = "";
    $("pw-button").disabled = true;
    post(claimed ? "/api/link" : "/api/claim", { password: $("pw").value }).then(show).catch(function () {
      $("pw-button").disabled = false;
      $("pw-error").textContent = "Could not reach your memory. Check your internet and try again.";
    });
  });

  function show(d) {
      $("pw-button").disabled = false;
      if (d.error) { $("pw-error").textContent = d.error; return; }
      link = d.link;
      $("pw").value = "";
      $("step-password").hidden = true;
      ["step-link", "step-apps", "step-try", "step-extra"].forEach(function (id) { $(id).hidden = false; });
      $("snippet-json").textContent = JSON.stringify({ mcpServers: { memory: { url: link } } }, null, 2);
      $("snippet-cli").textContent = "Claude Code:  claude mcp add --transport http memory " + link +
        "\\nCodex:        codex mcp add memory --url " + link +
        "\\nGemini CLI:   add to ~/.gemini/settings.json  { \\"mcpServers\\": { \\"memory\\": { \\"httpUrl\\": \\"" + link + "\\" } } }";
  }

  $("copy").addEventListener("click", function () {
    navigator.clipboard.writeText(link).then(function () {
      $("copied").hidden = false;
      setTimeout(function () { $("copied").hidden = true; }, 2500);
    }, function () { $("link-box").textContent = link; });
  });
  $("reveal").addEventListener("click", function () {
    var shown = $("link-box").textContent === link;
    $("link-box").textContent = shown ? "••••••••••••••••••••••••" : link;
    $("reveal").textContent = shown ? "Show it" : "Hide it";
  });

  document.querySelectorAll("[role=tab]").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll("[role=tab]").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== t.getAttribute("data-tab"); });
    });
  });

  $("download").addEventListener("click", function () {
    var token = link.split("/mcp/")[1];
    fetch("/export/" + token).then(function (r) { return r.json(); }).then(function (d) {
      var text = d.pages.sort(function (a, b) { return a.id < b.id ? -1 : 1; })
        .map(function (p) { return "<!-- page: " + p.id + " -->\\n" + p.text; }).join("\\n\\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
      a.download = "my-memory-" + new Date().toISOString().slice(0, 10) + ".md";
      a.click();
    });
  });
})();
</script>
</body>
</html>
`;
