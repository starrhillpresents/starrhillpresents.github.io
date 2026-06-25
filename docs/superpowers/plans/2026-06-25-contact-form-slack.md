# Contact Form → Slack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the off-site Google Form link on starrhillpresents.com with an on-page contact form whose submissions are forwarded to a Slack channel via a Cloudflare Worker.

**Architecture:** Static page form → JS `fetch` (JSON) → Cloudflare Worker (validates, blocks spam, formats) → Slack Incoming Webhook → dedicated channel. The Worker is the only component that holds the Slack secret; the public repo holds no secrets.

**Tech Stack:** Plain HTML + Bootstrap CSS (already loaded), vanilla JS (no framework), Cloudflare Worker (ES module), Slack Incoming Webhook. Tests via Node's built-in `node:test`. Deploy via Wrangler.

## Global Constraints

- Site is GitHub Pages (static) — **no server code may run on the site itself**.
- Repo `starrhillpresents/starrhillpresents.github.io` is **public** — no secrets in any committed file. The Slack webhook URL lives only as a Cloudflare secret (`SLACK_WEBHOOK_URL`).
- All feature work happens on branch `contact-form-slack`. `master` (the live site) is only touched at the final merge step.
- Inquiry-type options, verbatim: `Booking`, `Press/Media`, `Private Event/Venue`, `General`.
- Honeypot field name: `company` (legitimate users never fill it).
- CORS allowed origins: `https://starrhillpresents.com` and `https://www.starrhillpresents.com`.
- Worker name: `shp-contact`.
- Rate limiting is handled by a Cloudflare dashboard rate-limiting rule (Task 6), **not** custom Worker code.

---

### Task 1: On-page contact form markup

**Files:**
- Modify: `index.html` (the contact `<section>`, around line 242–248)

**Interfaces:**
- Produces: a `<form id="contact-form">` containing named fields `name`, `email`, `phone`, `inquiryType`, `message`, and honeypot `company`; a submit button `#cf-submit`; a status element `#cf-status`. Task 2's script consumes these IDs/names.

- [ ] **Step 1: Replace the Google Form link with the form**

In `index.html`, find this block (around line 245–247):

```html
			        <center>	    
					<h3> <a href="https://forms.gle/Nq3WBCZeVRQzYDdd6">Contact Us</a></li></h3>
									 </center>
```

Replace it with:

```html
			        <center>
					<h3>Contact Us</h3>
					</center>
					<form id="contact-form" class="contact-form" novalidate>
						<div class="row">
							<div class="col-sm-6 form-group">
								<label for="cf-name">Name *</label>
								<input type="text" id="cf-name" name="name" class="form-control" required>
							</div>
							<div class="col-sm-6 form-group">
								<label for="cf-email">Email *</label>
								<input type="email" id="cf-email" name="email" class="form-control" required>
							</div>
						</div>
						<div class="row">
							<div class="col-sm-6 form-group">
								<label for="cf-phone">Phone</label>
								<input type="tel" id="cf-phone" name="phone" class="form-control">
							</div>
							<div class="col-sm-6 form-group">
								<label for="cf-type">Inquiry type *</label>
								<select id="cf-type" name="inquiryType" class="form-control" required>
									<option value="">Choose…</option>
									<option>Booking</option>
									<option>Press/Media</option>
									<option>Private Event/Venue</option>
									<option>General</option>
								</select>
							</div>
						</div>
						<div class="form-group">
							<label for="cf-message">Message *</label>
							<textarea id="cf-message" name="message" rows="5" class="form-control" required></textarea>
						</div>
						<!-- honeypot: hidden from humans, bots fill it -->
						<div aria-hidden="true" style="position:absolute;left:-5000px;top:-5000px;">
							<input type="text" name="company" tabindex="-1" autocomplete="off">
						</div>
						<button type="submit" class="btn btn-primary" id="cf-submit">Send</button>
						<p id="cf-status" class="cf-status" role="status" aria-live="polite"></p>
					</form>
```

- [ ] **Step 2: Verify it renders**

Run: open the file in a browser — `open index.html`
Expected: the contact section shows Name/Email/Phone/Inquiry type/Message fields and a Send button, styled with the site's Bootstrap look. The honeypot field is NOT visible. (The Send button does nothing yet — that's Task 2.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add on-page contact form markup"
```

---

### Task 2: Submit handler script

**Files:**
- Create: `js/contact-form.js`
- Modify: `index.html` (add `<script>` include near the other scripts at the bottom)
- Modify: `css/custom.css` (status message colors)

**Interfaces:**
- Consumes: form element IDs/names from Task 1.
- Produces: a self-invoking script with a `WORKER_URL` constant (placeholder until Task 7) and `FALLBACK_EMAIL`. On submit it sends JSON `{name, email, phone, inquiryType, message, company}` to `WORKER_URL`. Task 4's Worker consumes this exact JSON shape. Task 7 sets the real `WORKER_URL`.

- [ ] **Step 1: Create `js/contact-form.js`**

```javascript
(function () {
  // TODO(Task 7): replace with the deployed Cloudflare Worker URL.
  var WORKER_URL = "https://REPLACE-ME.workers.dev";
  // Shown to visitors if sending fails. Confirm this is a monitored inbox.
  var FALLBACK_EMAIL = "info@starrhillpresents.com";

  var form = document.getElementById("contact-form");
  if (!form) return;
  var statusEl = document.getElementById("cf-status");
  var submitBtn = document.getElementById("cf-submit");

  function val(name) {
    var el = form.elements[name];
    return el ? String(el.value).trim() : "";
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "cf-status" + (kind ? " cf-status--" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      setStatus("Please fill in all required fields with a valid email.", "error");
      return;
    }

    var data = {
      name: val("name"),
      email: val("email"),
      phone: val("phone"),
      inquiryType: val("inquiryType"),
      message: val("message"),
      company: form.elements["company"] ? form.elements["company"].value : ""
    };

    var originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    setStatus("", "");

    fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Bad response " + res.status);
        setStatus("Thanks! We got your message and will be in touch.", "success");
        form.reset();
      })
      .catch(function () {
        setStatus(
          "Sorry — something went wrong. Please email us at " + FALLBACK_EMAIL + ".",
          "error"
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });
})();
```

- [ ] **Step 2: Add status colors to `css/custom.css`** (append at end)

```css
.cf-status { margin-top: 12px; font-weight: 600; }
.cf-status--success { color: #2e7d32; }
.cf-status--error { color: #c62828; }
```

- [ ] **Step 3: Include the script in `index.html`**

Find the script block near the bottom (after `smooth-scroll.min.js`, around line 277) and add this line after the existing `<script>` tags:

```html
        <script src="js/contact-form.js"></script>
```

- [ ] **Step 4: Verify client-side behavior in a browser**

Run: `open index.html`
Expected:
- Submitting with empty required fields → red message "Please fill in all required fields with a valid email." (no network call).
- Filling all fields and submitting → button shows "Sending…", then (because `WORKER_URL` is still the placeholder and will fail) a red fallback message appears with the email. This confirms the error path works. The success path is verified in Task 7.

- [ ] **Step 5: Commit**

```bash
git add js/contact-form.js css/custom.css index.html
git commit -m "feat: add contact form submit handler and status styles"
```

---

### Task 3: Worker validation logic (TDD)

**Files:**
- Create: `worker/src/lib.js`
- Create: `worker/test/lib.test.js`
- Create: `worker/package.json`

**Interfaces:**
- Produces three pure functions consumed by Task 4's `index.js`:
  - `isSpam(data) -> boolean` — true if honeypot `company` is non-empty.
  - `validateSubmission(data) -> string[]` — array of invalid field names (empty array = valid). Checks `name`, `email` (shape), `inquiryType`, `message`.
  - `buildSlackText(data) -> string` — the Slack message body.

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "shp-contact-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3"
  }
}
```

- [ ] **Step 2: Write the failing tests — `worker/test/lib.test.js`**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpam, validateSubmission, buildSlackText } from "../src/lib.js";

test("isSpam: true when honeypot filled", () => {
  assert.equal(isSpam({ company: "bot-co" }), true);
});

test("isSpam: false when honeypot empty or whitespace", () => {
  assert.equal(isSpam({ company: "" }), false);
  assert.equal(isSpam({ company: "   " }), false);
  assert.equal(isSpam({}), false);
});

test("validateSubmission: flags all missing required fields", () => {
  assert.deepEqual(validateSubmission({}), ["name", "email", "inquiryType", "message"]);
});

test("validateSubmission: rejects malformed email", () => {
  assert.deepEqual(
    validateSubmission({ name: "A", email: "nope", inquiryType: "Booking", message: "hi" }),
    ["email"]
  );
});

test("validateSubmission: passes valid submission", () => {
  assert.deepEqual(
    validateSubmission({ name: "A", email: "a@b.com", inquiryType: "Booking", message: "hi" }),
    []
  );
});

test("buildSlackText: includes inquiry header and all fields", () => {
  const t = buildSlackText({
    name: "Jane Doe", email: "jane@example.com", phone: "(555) 123-4567",
    inquiryType: "Booking", message: "Book the Tin Pan"
  });
  assert.match(t, /New contact — Booking/);
  assert.match(t, /Jane Doe/);
  assert.match(t, /jane@example\.com/);
  assert.match(t, /\(555\) 123-4567/);
  assert.match(t, /Book the Tin Pan/);
});

test("buildSlackText: shows em dash when phone is blank", () => {
  const t = buildSlackText({
    name: "Jane", email: "j@x.com", phone: "", inquiryType: "General", message: "hi"
  });
  assert.match(t, /\*Phone:\*  —/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd worker && node --test`
Expected: FAIL — cannot find module `../src/lib.js`.

- [ ] **Step 4: Implement `worker/src/lib.js`**

```javascript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSpam(data) {
  return Boolean(data && typeof data.company === "string" && data.company.trim() !== "");
}

export function validateSubmission(data) {
  if (!data || typeof data !== "object") return ["payload"];
  const errors = [];
  if (!data.name || !String(data.name).trim()) errors.push("name");
  if (!data.email || !EMAIL_RE.test(String(data.email).trim())) errors.push("email");
  if (!data.inquiryType || !String(data.inquiryType).trim()) errors.push("inquiryType");
  if (!data.message || !String(data.message).trim()) errors.push("message");
  return errors;
}

export function buildSlackText(data) {
  const phone = data.phone && String(data.phone).trim() ? String(data.phone).trim() : "—";
  return [
    `📩 *New contact — ${String(data.inquiryType).trim()}*`,
    `*Name:*  ${String(data.name).trim()}`,
    `*Email:*  ${String(data.email).trim()}`,
    `*Phone:*  ${phone}`,
    "─────────────────────────",
    String(data.message).trim()
  ].join("\n");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd worker && node --test`
Expected: PASS — all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add worker/package.json worker/src/lib.js worker/test/lib.test.js
git commit -m "feat: worker validation, spam, and slack-format logic with tests"
```

---

### Task 4: Worker request handler

**Files:**
- Create: `worker/src/index.js`
- Create: `worker/wrangler.toml`

**Interfaces:**
- Consumes: `isSpam`, `validateSubmission`, `buildSlackText` from Task 3; the `SLACK_WEBHOOK_URL` secret via `env` (set in Task 6).
- Produces: the deployable Worker. Default export with `fetch(request, env)`.

- [ ] **Step 1: Create `worker/src/index.js`**

```javascript
import { isSpam, validateSubmission, buildSlackText } from "./lib.js";

const ALLOWED_ORIGINS = [
  "https://starrhillpresents.com",
  "https://www.starrhillpresents.com"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false }), { status: 405, headers });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers });
    }

    // Honeypot tripped: pretend success, post nothing.
    if (isSpam(data)) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    const errors = validateSubmission(data);
    if (errors.length) {
      return new Response(JSON.stringify({ ok: false, errors }), { status: 422, headers });
    }

    const slackRes = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: buildSlackText(data) })
    });

    if (!slackRes.ok) {
      return new Response(JSON.stringify({ ok: false }), { status: 502, headers });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }
};
```

- [ ] **Step 2: Create `worker/wrangler.toml`**

```toml
name = "shp-contact"
main = "src/index.js"
compatibility_date = "2026-06-25"
```

- [ ] **Step 3: Verify the Worker logic tests still pass** (handler has no separate unit test; it's exercised end-to-end in Task 6/7)

Run: `cd worker && node --test`
Expected: PASS — the 7 logic tests from Task 3 still pass.

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.js worker/wrangler.toml
git commit -m "feat: worker fetch handler with CORS and Slack forwarding"
```

---

### Task 5: Create the Slack app + Incoming Webhook (manual)

**Files:** none (external setup). Record the webhook URL somewhere private — it is a secret, never commit it.

- [ ] **Step 1: Create the channel** — in Slack, create a channel, e.g. `#shp-contact`.

- [ ] **Step 2: Create the app** — go to https://api.slack.com/apps → **Create New App** → **From scratch** → name it `SHP Contact Form` → pick your workspace → **Create App**.

- [ ] **Step 3: Enable Incoming Webhooks** — in the app settings, **Incoming Webhooks** → toggle **Activate Incoming Webhooks** on.

- [ ] **Step 4: Add the webhook** — click **Add New Webhook to Workspace** → choose `#shp-contact` → **Allow**.

- [ ] **Step 5: Copy the webhook URL** — it looks like `https://hooks.slack.com/services/T000/B000/xxxx`. Keep it private for Task 6.

- [ ] **Step 6: Smoke-test the webhook** (optional but recommended)

Run (paste your real URL):
```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"text":"✅ SHP contact webhook test"}' \
  https://hooks.slack.com/services/PASTE/YOUR/URL
```
Expected: `ok` returned, and the message appears in `#shp-contact`.

---

### Task 6: Deploy the Worker to Cloudflare (manual + CLI)

**Files:** none committed (deploys `worker/` to Cloudflare; sets the secret there).

- [ ] **Step 1: Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up (if you don't have one).

- [ ] **Step 2: Install deps**

Run: `cd worker && npm install`
Expected: `wrangler` installs into `worker/node_modules`.

- [ ] **Step 3: Authorize Wrangler** (interactive — run it yourself in a terminal; opens a browser)

Run: `cd worker && npx wrangler login`
Expected: browser opens, you click **Allow**, terminal says "Successfully logged in."

- [ ] **Step 4: Deploy**

Run: `cd worker && npx wrangler deploy`
Expected: prints a deployed URL like `https://shp-contact.<your-subdomain>.workers.dev`. **Copy this URL — Task 7 needs it.**

- [ ] **Step 5: Set the Slack secret**

Run: `cd worker && npx wrangler secret put SLACK_WEBHOOK_URL`
When prompted, paste the Slack webhook URL from Task 5. Expected: "Success! Uploaded secret SLACK_WEBHOOK_URL".

- [ ] **Step 6: End-to-end test the Worker via curl**

Run (use your real workers.dev URL):
```bash
curl -X POST -H 'Content-Type: application/json' \
  -H 'Origin: https://starrhillpresents.com' \
  -d '{"name":"Curl Test","email":"test@example.com","phone":"","inquiryType":"General","message":"Hello from curl"}' \
  https://shp-contact.YOUR-SUBDOMAIN.workers.dev
```
Expected: `{"ok":true}` returned AND a formatted message appears in `#shp-contact`.

- [ ] **Step 7: Add a rate-limiting rule (optional)** — in the Cloudflare dashboard, under the Worker's **Settings → (Security) Rate limiting**, add a rule limiting requests per IP (e.g. 5/min). This is the "light rate limiting" from the spec, configured with no code.

---

### Task 7: Wire the live Worker URL and go live

**Files:**
- Modify: `js/contact-form.js` (set real `WORKER_URL`, confirm `FALLBACK_EMAIL`)

- [ ] **Step 1: Set the real Worker URL**

In `js/contact-form.js`, replace:
```javascript
  var WORKER_URL = "https://REPLACE-ME.workers.dev";
```
with the URL from Task 6 Step 4, e.g.:
```javascript
  var WORKER_URL = "https://shp-contact.YOUR-SUBDOMAIN.workers.dev";
```
Also confirm `FALLBACK_EMAIL` is a real monitored inbox; change it if needed.

- [ ] **Step 2: Commit**

```bash
git add js/contact-form.js
git commit -m "feat: point contact form at deployed worker"
```

- [ ] **Step 3: End-to-end test from the live-ish page**

Run: `open index.html` (or test on the deployed site after merge)
Fill the form with real-looking values and submit.
Expected: green "Thanks! We got your message and will be in touch." AND a formatted message appears in `#shp-contact`.

> Note: opening `index.html` as a `file://` page sends `Origin: null`, which the Worker's CORS will reject. For a true end-to-end test before merge, either test with the curl command from Task 6, or merge to `master` (Step 4) and test on `https://starrhillpresents.com` directly.

- [ ] **Step 4: Merge to master and go live**

```bash
git checkout master
git merge --no-ff contact-form-slack -m "feat: on-page contact form feeding Slack"
git push
```
Expected: GitHub Pages rebuilds; within ~1 minute the new form is live at starrhillpresents.com.

- [ ] **Step 5: Final live verification** — open https://starrhillpresents.com, submit the form, confirm the message lands in `#shp-contact`. Done.

---

## Notes / Out of Scope

- The dead `mail/` PHP directory is left untouched (separate cleanup).
- The `worker/` source is committed to the public repo (no secrets in it); GitHub Pages may serve those source files statically, which is harmless.
- No database/persistence and no email autoresponder — Slack is the sole destination.
