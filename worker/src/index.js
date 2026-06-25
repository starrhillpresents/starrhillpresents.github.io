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
