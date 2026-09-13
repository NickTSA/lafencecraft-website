// netlify/functions/submit-estimate.js
//
// Sends a clean, branded "New Estimate Request" email to the LA Fence Craft
// inbox whenever someone submits the short estimate form (the one on the
// homepage, /contact-us/, and /free-estimate/ — NOT the calculator, which
// has its own richer function: submit-lead.js).
//
// Why this exists: that form already posts to Netlify Forms directly (so
// submissions still show up in the Netlify dashboard, and Netlify's own
// spam/honeypot filtering still applies). This function runs *alongside*
// that, purely to replace Netlify's plain-text notification email with a
// nicely formatted one -- Netlify doesn't support customizing the HTML of
// its own form notification emails, only the subject line.
//
// REQUIRED SETUP (Netlify dashboard, not in this file):
//   Site settings -> Environment variables -> add:
//     BREVO_API_KEY = your Brevo transactional API key
//   (Same key submit-lead.js uses -- nothing extra to set up if that
//   function is already working.)
//
// IMPORTANT: SENDER.email below must be a verified sender (or verified
// domain) in Brevo -- Senders & IP -> Senders -- before this will send.
//
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const OWNER_EMAIL = "info@lafencecraft.com";
const SENDER = { email: "info@lafencecraft.com", name: "LA Fence Craft" };

const ALLOWED_ORIGINS = [
  "https://lafencecraft.com",
  "https://www.lafencecraft.com",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function toE164(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// One labeled row in the "Project" card -- skips itself entirely when the
// field is empty, so optional fields never leave an awkward blank line.
function row(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:9px 0; border-bottom:1px solid #DEE1DB; color:#5B6167; font-size:13.5px; width:40%;">${esc(label)}</td>
      <td style="padding:9px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B; font-size:13.5px;">${esc(value)}</td>
    </tr>`;
}

function buildOwnerEmailHtml(p) {
  const digits = toE164(p.phone);
  const smsBody = encodeURIComponent(
    `Hi ${String(p.name || "").split(" ")[0]}, it's Nick with LA Fence Craft — just got your estimate request. When's a good time to swing by for a free look?`
  );

  const actionButtons = digits ? `
    <tr>
      <td style="padding:0 28px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="padding-right:6px; width:50%;">
              <a href="sms:${digits}&body=${smsBody}" style="display:block; background-color:#C2572B; color:#0C182B; font-weight:700; font-size:15px; padding:14px 10px; border-radius:8px; text-decoration:none; text-align:center;">Text this customer</a>
            </td>
            <td style="padding-left:6px; width:50%;">
              <a href="tel:${digits}" style="display:block; background-color:#0C182B; color:#FFFFFF; font-weight:700; font-size:15px; padding:14px 10px; border-radius:8px; text-decoration:none; text-align:center;">Call now</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  const projectRows = [
    row("What they want built", p.product),
    row("Material", p.material),
    row("ZIP code", p.zip),
    row("Linear feet", p.linear_feet),
  ].join("");

  const notesBlock = p.message ? `
    <tr>
      <td style="padding:0 28px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EFE9; border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0 0 4px; font-size:11.5px; font-weight:700; color:#0C182B; text-transform:uppercase; letter-spacing:0.05em;">What they told us</p>
              <p style="margin:0; font-size:13.5px; line-height:1.5; color:#0C182B;">${esc(p.message)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  return `
<div style="background-color:#F4F4F0; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background-color:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #DEE1DB;">
    <tr><td style="background-color:#C2572B; padding:14px 28px;"><span style="color:#0C182B; font-size:12.5px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">New Estimate Request</span></td></tr>
    <tr><td style="background-color:#0C182B; padding:20px 28px;"><span style="color:#F4F4F0; font-size:18px; font-weight:800;">LA FENCE CRAFT</span></td></tr>

    <tr>
      <td style="padding:26px 28px 6px;">
        <p style="margin:0 0 4px; font-size:20px; font-weight:800; color:#0C182B;">${esc(p.name)}</p>
        <p style="margin:0 0 18px; font-size:13px; color:#5B6167;">Submitted ${esc(p.submitted_at)}</p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 28px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EFE9; border-radius:10px;">
          <tr>
            <td style="padding:18px;">
              <p style="margin:0 0 4px; font-size:11.5px; font-weight:700; color:#0C182B; text-transform:uppercase; letter-spacing:0.05em;">Contact</p>
              <p style="margin:0 0 2px; font-size:14.5px; color:#0C182B;"><a href="tel:${digits || ''}" style="color:#0C182B; text-decoration:none; font-weight:700;">${esc(p.phone)}</a></p>
              <p style="margin:0; font-size:14.5px; color:#0C182B;"><a href="mailto:${esc(p.email)}" style="color:#0C182B; text-decoration:none;">${esc(p.email)}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${actionButtons}

    <tr>
      <td style="padding:0 28px 6px;">
        <p style="margin:0 0 6px; font-size:11.5px; font-weight:700; color:#0C182B; text-transform:uppercase; letter-spacing:0.05em;">Project</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          ${projectRows}
        </table>
      </td>
    </tr>

    <tr><td style="padding:14px 28px 0;"></td></tr>
    ${notesBlock}

    <tr>
      <td style="padding:10px 28px 28px; border-top:1px solid #DEE1DB;">
        <p style="margin:14px 0 0; font-size:12px; color:#7C8794;">LA Fence Craft &middot; 8931 Garvey Ave, Rosemead, CA 91770 &middot; lafencecraft.com</p>
      </td>
    </tr>
  </table>
</div>`;
}

async function sendBrevoEmail({ to, toName, subject, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });
  const responseBody = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: responseBody };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const headers = corsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!BREVO_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured: BREVO_API_KEY not set" }) };
  }

  let p;
  try {
    p = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  // Honeypot: mirrors the check already done client-side in site.js. A bot
  // that skips straight to the API wouldn't have run that JS, so this is
  // the real backstop.
  if (p.website) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, skipped: "honeypot" }) };
  }

  if (!p.name || !p.email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields: name, email" }) };
  }

  if (!p.submitted_at) {
    p.submitted_at = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  }

  try {
    const result = await sendBrevoEmail({
      to: p.owner_email || OWNER_EMAIL,
      toName: "LA Fence Craft",
      subject: `New Estimate Request: ${p.name}${p.product ? " — " + p.product : ""}`,
      html: buildOwnerEmailHtml(p),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, result }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Send failed", detail: String(e) }) };
  }
};
