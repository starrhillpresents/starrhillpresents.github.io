# Starr Hill Presents — site notes

Static one-page site for **starrhillpresents.com**, hosted on **GitHub Pages**
(repo `starrhillpresents/starrhillpresents.github.io`, served from the `master`
branch) behind **Cloudflare** (DNS + CDN). Custom domain is set via the `CNAME`
file. There is no build step — edit the files, commit, and push to `master` to
go live (~1 min).

> The `mail/` directory (PHP + SwiftMailer) is **dead leftover** from the
> original template. GitHub Pages cannot run PHP; nothing uses it.

## Contact form → Slack

The contact section is a real on-page form that sends submissions to a Slack
channel. Because GitHub Pages is static (no server code), a small Cloudflare
Worker sits in the middle and is the only piece that holds the Slack secret.

```
Visitor submits form on starrhillpresents.com
   │  js/contact-form.js  → fetch POST (JSON) →
   ▼
Cloudflare Worker  "shp-contact"   (worker/ in this repo)
   • validates, blocks honeypot spam, escapes Slack control chars
   • POSTs to the Slack Incoming Webhook (URL stored as a Cloudflare secret)
   ▼
Slack Incoming Webhook → channel #shp-contact
```

### Files

| File | Role |
|------|------|
| `index.html` (contact `<section>`, ~line 243) | Form markup. Field `name`s and element IDs are a contract — see below. |
| `css/custom.css` (`/* Contact form */` block) | All form styling, scoped under `.contact-form` to override the template theme. |
| `js/contact-form.js` | Client submit handler. Holds `WORKER_URL` and `FALLBACK_EMAIL`. |
| `worker/src/index.js` | Cloudflare Worker request handler (CORS, routing). |
| `worker/src/lib.js` | Pure logic: `isSpam`, `validateSubmission`, `buildSlackText`. |
| `worker/test/lib.test.js` | Tests for lib.js — run `cd worker && node --test` (8 tests). |
| `worker/wrangler.toml` | Worker config (`name = "shp-contact"`). |

### The contract (do not rename casually)

The browser sends JSON with exactly these keys, and the Worker reads exactly
these keys: `name`, `email`, `phone`, `inquiryType`, `message`, `company`.
- `company` is the **honeypot** — hidden from humans; if filled, the Worker
  silently drops the submission (real users never fill it).
- Element IDs the JS depends on: form `#contact-form`, button `#cf-submit`,
  status line `#cf-status`.
- Inquiry-type options live in the `<select>` in `index.html`.

## How to make common changes

**Change the form's look** → edit the `/* Contact form */` block in
`css/custom.css`. The site's template theme aggressively styles bare
`input[type="text"]` and `button[type="submit"]`, so form rules are scoped
under `.contact-form` (and use `border-radius: ... !important` on the button)
to win specificity. Keep that scoping or the theme's grey fields / green
full-width button come back.

**Add / rename / reorder inquiry types** → edit the `<option>`s in the
`<select id="cf-type">` in `index.html`. No other change needed (the Worker
just echoes `inquiryType` into the Slack message).

**Change form fields** → update `index.html` AND the payload in
`js/contact-form.js` AND `validateSubmission` in `worker/src/lib.js` so the
three stay in sync, then redeploy the Worker (below).

**Change the Slack message format** → edit `buildSlackText` in
`worker/src/lib.js`, update/run the tests, then redeploy the Worker.

### ⚠️ CSS/JS changes need a cache-bump

GitHub Pages serves CSS/JS with `max-age=14400` (4h) behind Cloudflare, so
edits won't appear until the cache expires. When you change `css/custom.css`
(or `js/contact-form.js`), bump the version query on its `<link>`/`<script>`
in `index.html`, e.g. `css/custom.css?v=20260625-2` → `?v=20260626-1`. That
gives the file a fresh URL so browsers fetch it immediately.

### Deploying the Worker (only when worker/ changes)

The Worker is **not** deployed by pushing to GitHub — it deploys to Cloudflare
separately via Wrangler.

```bash
cd worker
npm install            # first time only
npx wrangler login     # first time / new machine (opens browser)
node --test            # run the tests
npx wrangler deploy    # deploy → prints the workers.dev URL
```

The deployed URL (currently `https://shp-contact.generalapps.workers.dev`) is
wired into `WORKER_URL` in `js/contact-form.js`. CORS allow-list lives in
`worker/src/index.js` (`ALLOWED_ORIGINS`) — must include the site's domain.

### Secrets

The Slack Incoming Webhook URL is the only secret. It is **never** in this repo
— it lives only as the Cloudflare Worker secret `SLACK_WEBHOOK_URL`:

```bash
cd worker
npx wrangler secret put SLACK_WEBHOOK_URL   # paste the webhook URL when prompted
```

To rotate it: regenerate the webhook in the Slack app
(https://api.slack.com/apps → SHP Contact Form → Incoming Webhooks) and run the
command above again.

### Quick end-to-end test (no browser needed)

```bash
curl -X POST -H 'Content-Type: application/json' \
  -H 'Origin: https://starrhillpresents.com' \
  -d '{"name":"Test","email":"t@example.com","phone":"","inquiryType":"General","message":"hi"}' \
  https://shp-contact.generalapps.workers.dev
# → {"ok":true} and a message appears in #shp-contact
```

## Design / planning docs

The original spec and implementation plan are in
`docs/superpowers/specs/` and `docs/superpowers/plans/`.
