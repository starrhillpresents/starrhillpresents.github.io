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
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const phone = data.phone && String(data.phone).trim() ? String(data.phone).trim() : "—";
  return [
    `📩 *New contact — ${esc(String(data.inquiryType).trim())}*`,
    `*Name:*  ${esc(String(data.name).trim())}`,
    `*Email:*  ${esc(String(data.email).trim())}`,
    `*Phone:*  ${esc(phone)}`,
    "─────────────────────────",
    esc(String(data.message).trim())
  ].join("\n");
}
