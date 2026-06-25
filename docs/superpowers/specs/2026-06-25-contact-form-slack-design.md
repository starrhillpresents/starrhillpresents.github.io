# Contact Form → Slack — Design Spec

**Date:** 2026-06-25
**Site:** starrhillpresents.com (GitHub Pages, repo `starrhillpresents/starrhillpresents.github.io`)
**Goal:** Replace the off-site Google Form link with a real on-page contact form whose
submissions are delivered to a dedicated Slack channel.

## Problem & Constraints

- The current "contact form" is just a hyperlink to a Google Form (`index.html` line ~246).
- A leftover `mail/mail.php` (SwiftMailer) exists but is **dead code** — GitHub Pages is
  static hosting and cannot execute PHP.
- **Core constraint:** a static site cannot run server code, so the form needs an external
  service to receive submissions and post them to Slack.
- The repo is **public**, so no secrets may live in repo files.

## Architecture

```
Visitor fills form on starrhillpresents.com
        │  (JavaScript: validate + send JSON via fetch)
        ▼
Cloudflare Worker  ◄── holds the Slack webhook secret (Cloudflare env var, never in repo)
   • checks honeypot + required fields
   • formats a Slack message
   • POSTs to Slack Incoming Webhook
        │
        ▼
Slack Incoming Webhook  ──►  dedicated channel (e.g. #shp-contact)
```

Four units, each with one responsibility:

1. **The form** — markup in `index.html`, replacing the Google Form link. Styled with the
   existing Bootstrap template classes.
2. **The submit script** — `js/contact-form.js`. Validates input, runs the no-reload submit,
   shows inline success/error. Depends only on the Worker URL.
3. **The Cloudflare Worker** — source in `worker/`, deployed separately via Wrangler. The only
   unit that knows the Slack secret. Validates, blocks spam, formats, forwards. Depends on the
   `SLACK_WEBHOOK_URL` secret (Cloudflare env var).
4. **The Slack app** — an Incoming Webhook pointed at the chosen channel. This is the
   user-requested "Slack app."

**Security boundary:** repo (public) contains only form + script + Worker *source* — no
secrets. The Slack webhook URL exists only as an encrypted Cloudflare environment variable.

## Form Fields

| Field        | Type     | Required | Notes                                                  |
|--------------|----------|----------|--------------------------------------------------------|
| Name         | text     | yes      |                                                        |
| Email        | email    | yes      | validated for shape                                    |
| Phone        | tel      | no       |                                                        |
| Inquiry type | select   | yes      | Booking · Press/Media · Private Event/Venue · General  |
| Message      | textarea | yes      |                                                        |
| Honeypot     | hidden   | —        | visually hidden; if filled, submission is dropped      |

## Submission UX (no page reload)

- On submit: disable button, show "Sending…".
- Success: green inline message — "Thanks! We got your message and will be in touch."
- Failure: red inline message with an email fallback so no submission is silently lost.

## Spam Protection (all enforced in the Worker)

- Honeypot field — if non-empty, silently drop (return success to the bot, post nothing).
- Require all required fields present + valid email shape.
- CORS locked to `https://starrhillpresents.com` (and `https://www.starrhillpresents.com`).
- Light rate limiting to prevent hammering.

## Slack Message Format

```
📩 New contact — Booking
Name:   Jane Doe
Email:  jane@example.com
Phone:  (555) 123-4567
─────────────────────────
We'd love to book the Tin Pan for an October show...
```

Inquiry type in the header enables at-a-glance triage.

## One-Time Setup (walked through during implementation, ~10 min)

1. Create the Slack app + Incoming Webhook → copy the webhook URL.
2. Create a free Cloudflare account → deploy the Worker → paste the webhook URL as the
   `SLACK_WEBHOOK_URL` secret.
3. Wire the Worker's URL into `js/contact-form.js`, commit, push → live.

## Cost / Dependencies

- Cloudflare Workers free tier: 100,000 requests/day — far above any contact-form volume.
  Genuine $0 ongoing cost.
- Only ongoing dependency: the Cloudflare account staying active.

## Out of Scope (YAGNI)

- Removing the dead `mail/` PHP directory (separate cleanup; not required for this feature).
- Email delivery / autoresponders — Slack is the sole destination for now.
- Storing submissions in a database.
