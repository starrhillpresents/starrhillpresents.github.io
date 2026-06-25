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

test("buildSlackText: escapes Slack control characters to neutralize @channel pings", () => {
  const t = buildSlackText({
    name: "A & B", email: "x@y.com", phone: "",
    inquiryType: "General", message: "ping <!channel> & <!here>"
  });
  assert.doesNotMatch(t, /<!channel>/);
  assert.doesNotMatch(t, /<!here>/);
  assert.match(t, /&lt;!channel&gt;/);
  assert.match(t, /A &amp; B/);
});
