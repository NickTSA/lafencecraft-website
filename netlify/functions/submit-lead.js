// netlify/functions/submit-lead.js
//
// This function receives lead data from the calculator and sends:
//   1. A quote email to the customer
//   2. An alert email to LA Fence Craft
// ...both through Brevo's transactional email API. A quote text is
// intentionally not sent automatically — see the note near the bottom of
// this file.
//
// REQUIRED SETUP (Netlify dashboard, not in this file):
//   Site settings -> Environment variables -> add:
//     BREVO_API_KEY = your Brevo transactional API key
//
// IMPORTANT: SENDER.email below must be a verified sender (or verified
// domain) in Brevo -- Senders & IP -> Senders -- before this will send.
// Brevo rejects the send with a 400 if the sender isn't verified.
//
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const OWNER_EMAIL = "info@lafencecraft.com";
const SENDER = { email: "info@lafencecraft.com", name: "LA Fence Craft" };

// Maps material_key + variant_key (sent by the site) to the matching photo
// filename in /images. Falls back to a material-level hero shot if the exact
// color/type isn't in this table.
const PHOTO_MAP = {
  vinyl: {
    white: "vinyl_white.jpg",
    almond: "vinyl_almond.jpg",
    hazelnut: "vinyl_hazelnut.jpg",
    espresso: "vinyl_espresso.jpg",
    cayanne: "vinyl_cayanne.jpg",
    storm: "vinyl_storm.jpg",
    _hero: "vinyl_hero.jpg",
  },
  composite: {
    peanut_butter: "composite_peanut_butter.jpg",
    gray: "composite_gray.jpg",
    antique: "composite_antique.jpg",
    charcoal: "composite_charcoal.jpg",
    teak: "composite_teak.jpg",
    ipe: "composite_ipe.jpg",
    _hero: "composite_brown_wall.jpg",
  },
  aluminum: {
    black: "aluminum_black_install.jpg",
    white: "aluminum_white.jpg",
    charcoal: "aluminum_charcoal.jpg",
    _hero: "aluminum_hero.jpg",
  },
  wood: {
    rough: "wood_rough_b.jpg",
    smooth: "wood_smooth_b.jpg",
    _hero: "wood_rough_b.jpg",
  },
};

function getPhotoUrl(p, host) {
  const group = PHOTO_MAP[p.material_key];
  if (!group) return null;
  const filename = group[p.variant_key] || group._hero;
  if (!filename) return null;
  return `https://${host}/calculator/images/${filename}`;
}

// Allow requests from your site (and localhost, for testing)
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

// Convert a loosely-formatted US phone number into E.164 (+1XXXXXXXXXX),
// used to build the one-tap call/text links in the owner email.
function toE164(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null; // not a recognizable US number; caller should skip SMS
}

function money(v) {
  // payload already sends formatted strings like "$5,100" -- pass through
  return v || "";
}

function buildClientEmailHtml(p, host) {
  const photoUrl = getPhotoUrl(p, host);
  const photoBlock = photoUrl ? `
    <tr>
      <td style="padding:0;">
        <img src="${photoUrl}" width="580" alt="${p.material}" style="width:100%; max-width:580px; height:220px; object-fit:cover; display:block;">
      </td>
    </tr>` : '';

  const mapUrl = buildMapImageUrl(p, host);
  const mapBlock = mapUrl ? `
    <tr>
      <td style="padding:22px 28px 0;">
        <p style="margin:0 0 8px; font-size:11.5px; font-weight:700; color:#0C182B; text-transform:uppercase; letter-spacing:0.05em;">Your measured fence line</p>
        <img src="${mapUrl}" width="524" alt="Satellite view of your measured fence line" style="width:100%; max-width:524px; border-radius:8px; border:1px solid #DEE1DB; display:block;">
      </td>
    </tr>` : '';

  return `
<div style="background-color:#F4F4F0; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px; margin:0 auto; background-color:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #DEE1DB;">
    <tr>
      <td style="background-color:#0C182B; padding:26px 28px;">
        <span style="color:#F4F4F0; font-size:19px; font-weight:800; letter-spacing:0.3px;">LA FENCE CRAFT</span><br>
        <span style="color:#8FAFC2; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Licensed &amp; Insured · CA Lic #1028396</span>
      </td>
    </tr>${photoBlock}
    <tr>
      <td style="padding:28px 28px 6px;">
        <p style="margin:0 0 12px; font-size:17px; color:#0C182B;">Hi ${p.name},</p>
        <p style="margin:0 0 8px; font-size:14.5px; line-height:1.6; color:#5B6167;">
          Thanks for using our instant fence calculator! Here's your preliminary estimate — a real number, not a guess.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EFE9; border:1px solid #DCD5C4; border-radius:10px;">
          <tr>
            <td style="padding:22px; text-align:center;">
              <div style="font-family:'Courier New', monospace; font-size:28px; font-weight:700; color:#0C182B;">
                ${money(p.estimate_low)} – ${money(p.estimate_high)}
              </div>
              <div style="font-size:12px; color:#5B6167; margin-top:6px;">Estimated total, installed. Final price confirmed on-site.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EFE9; border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0 0 4px; font-size:11.5px; font-weight:700; color:#0C182B; text-transform:uppercase; letter-spacing:0.05em;">You picked: ${p.material}</p>
              <p style="margin:0; font-size:13.5px; line-height:1.5; color:#0C182B;">${p.material_blurb || ""}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Height</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.height}</td></tr>
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Fence length</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.footage}</td></tr>
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Gates</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.gates}</td></tr>
          <tr><td style="padding:10px 0; color:#5B6167;">Property address</td><td style="padding:10px 0; text-align:right; font-weight:700; color:#0C182B;">${p.address || ""}</td></tr>
        </table>
      </td>
    </tr>${mapBlock}
    <tr>
      <td style="padding:24px 28px 8px; text-align:center;">
        <a href="tel:+16265863378" style="display:inline-block; background-color:#C2572B; color:#0C182B; font-weight:700; font-size:15px; padding:14px 32px; border-radius:8px; text-decoration:none;">
          Call to Schedule Your Free Visit
        </a>
        <p style="margin:10px 0 0; font-size:12.5px; color:#7C8794;">Or just reply to this email — a real person reads these.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F0; border-radius:10px;">
          <tr>
            <td style="padding:18px;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#0C182B; text-transform:uppercase; letter-spacing:0.05em;">📍 Visit Our Showroom</p>
              <p style="margin:0 0 4px; font-size:14px; color:#0C182B;">See and touch every color and material in person before you decide.</p>
              <p style="margin:8px 0 0; font-size:13.5px; color:#5B6167;">
                8931 Garvey Ave, Rosemead, CA 91770<br>
                <a href="tel:+16265863378" style="color:#0C182B; font-weight:700; text-decoration:none;">626-586-3378</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0; font-size:13.5px; color:#0C182B;">✓&nbsp; Free, no-obligation in-home consultation</td></tr>
          <tr><td style="padding:6px 0; font-size:13.5px; color:#0C182B;">✓&nbsp; Full warranty on materials and workmanship</td></tr>
          <tr><td style="padding:6px 0; font-size:13.5px; color:#0C182B;">✓&nbsp; Flexible financing available</td></tr>
          <tr><td style="padding:6px 0; font-size:13.5px; color:#0C182B;">✓&nbsp; Over a decade installing fences across Greater LA</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #C2572B;">
          <tr>
            <td style="padding:4px 0 4px 16px;">
              <p style="margin:0 0 6px; font-size:13.5px; font-style:italic; color:#0C182B; line-height:1.5;">"Great customer service, very professional, good workmanship and fair prices."</p>
              <p style="margin:0; font-size:12px; color:#7C8794;">— Kat L., Verified Client</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px 8px;">
        <p style="margin:0 0 2px; font-size:14px; color:#0C182B;">Talk soon,</p>
        <p style="margin:0 0 2px; font-size:15px; font-weight:700; color:#0C182B;">LA Fence Craft</p>
        <p style="margin:6px 0 0; font-size:13px; color:#5B6167;">
          <a href="tel:+16265863378" style="color:#0C182B; text-decoration:none;">626-586-3378</a>
          &nbsp;·&nbsp;
          <a href="mailto:info@lafencecraft.com" style="color:#0C182B; text-decoration:none;">info@lafencecraft.com</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 28px; border-top:1px solid #DEE1DB;">
        <p style="margin:0 0 10px; font-size:11.5px; line-height:1.5; color:#7C8794;">
          This is a preliminary, non-binding estimate based on approximate satellite measurements and standard installation conditions. Actual pricing may vary based on terrain, access, permitting, material availability, and site conditions confirmed during an in-person visit.
        </p>
        <p style="margin:0; font-size:12px; color:#7C8794;">LA Fence Craft · 8931 Garvey Ave, Rosemead, CA 91770 · lafencecraft.com</p>
      </td>
    </tr>
  </table>
</div>`;
}

function buildOwnerEmailHtml(p, host) {
  const mapUrl = buildMapImageUrl(p, host);
  const mapBlock = mapUrl ? `
    <tr>
      <td style="padding:0 28px 20px;">
        <p style="margin:0 0 8px; font-size:12.5px; font-weight:700; color:#5B6167; text-transform:uppercase;">Measured fence line</p>
        <img src="${mapUrl}" width="504" alt="Satellite view of the measured fence line" style="width:100%; max-width:504px; border-radius:8px; border:1px solid #DEE1DB; display:block;">
        <p style="margin:8px 0 0; font-size:12px; color:#7C8794;">Also attached to this email as fence-map.png.</p>
      </td>
    </tr>` : '';

  // One-tap actions. The sms: link pre-fills the message so Nick can send a
  // real person-to-person text in a couple of seconds — no A2P registration
  // needed, unlike automated sending. The "?&body=" form is the combination
  // that works across both iOS and Android.
  const digits = String(p.phone || "").replace(/\D/g, "");
  const smsBody = encodeURIComponent(
    `Hi ${String(p.name || "").split(" ")[0]}, it's Nick with LA Fence Craft — just got your fence estimate request. When's a good time to swing by for a free look?`
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
        <p style="margin:10px 0 0; font-size:12px; color:#7C8794; text-align:center;">Reaching out within the hour dramatically improves your odds of booking the job.</p>
      </td>
    </tr>` : '';

  return `
<div style="background-color:#F4F4F0; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background-color:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #DEE1DB;">
    <tr><td style="background-color:#C2572B; padding:14px 28px;"><span style="color:#0C182B; font-size:12.5px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">New Fence Lead</span></td></tr>
    <tr><td style="background-color:#0C182B; padding:20px 28px;"><span style="color:#F4F4F0; font-size:18px; font-weight:800;">LA FENCE CALCULATOR</span></td></tr>
    <tr>
      <td style="padding:26px 28px 8px;">
        <p style="margin:0 0 4px; font-size:20px; font-weight:800; color:#0C182B;">${p.name}</p>
        <p style="margin:0 0 18px; font-size:13px; color:#5B6167;">Submitted ${p.submitted_at}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EFE9; border-radius:10px; margin-bottom:20px;">
          <tr><td style="padding:16px 18px;">
            <p style="margin:0 0 8px; font-size:14.5px; color:#0C182B;">📞 <a href="tel:${digits}" style="color:#0C182B; font-weight:700; text-decoration:none;">${p.phone}</a></p>
            <p style="margin:0 0 8px; font-size:14.5px; color:#0C182B;">✉️ <a href="mailto:${p.email}" style="color:#0C182B; font-weight:700; text-decoration:none;">${p.email}</a></p>
            <p style="margin:0; font-size:14.5px; color:#0C182B;">📍 ${p.address || ""}</p>
          </td></tr>
        </table>
      </td>
    </tr>${actionButtons}
    <tr>
      <td style="padding:0 28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EFE9; border:1px solid #DCD5C4; border-radius:10px;">
          <tr><td style="padding:18px; text-align:center;">
            <div style="font-family:'Courier New', monospace; font-size:24px; font-weight:700; color:#0C182B;">${money(p.estimate_low)} – ${money(p.estimate_high)}</div>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Material</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.material}</td></tr>
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Height</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.height}</td></tr>
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Fence length</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.footage}</td></tr>
          <tr><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; color:#5B6167;">Rate (internal)</td><td style="padding:10px 0; border-bottom:1px solid #DEE1DB; text-align:right; font-weight:700; color:#0C182B;">${p.rate}</td></tr>
          <tr><td style="padding:10px 0; color:#5B6167;">Gates</td><td style="padding:10px 0; text-align:right; font-weight:700; color:#0C182B;">${p.gates}</td></tr>
        </table>
      </td>
    </tr>${mapBlock}
    <tr>
      <td style="padding:16px 28px 24px;">
        <p style="margin:0 0 6px; font-size:12.5px; font-weight:700; color:#5B6167; text-transform:uppercase;">Notes</p>
        <p style="margin:0; font-size:14px; color:#0C182B; background-color:#F4F4F0; padding:14px; border-radius:8px;">${p.notes || "(none)"}</p>
        ${(Array.isArray(p.photos) && p.photos.length) ? `<p style="margin:14px 0 0; font-size:13px; color:#0C182B; font-weight:700;">📎 ${p.photos.length} yard photo${p.photos.length === 1 ? '' : 's'} attached to this email.</p>` : ''}
      </td>
    </tr>
  </table>
</div>`;
}

// Builds the URL of our own map-image proxy (never Google's URL directly —
// that would put the Static Maps key inside the email source).
function buildMapImageUrl(p, host){
  if(!Array.isArray(p.map_paths) || !p.map_paths.length) return null;
  const params = p.map_paths
    .slice(0, 8)
    .filter(mp => mp && typeof mp.enc === "string" && mp.enc.length)
    .map(mp => {
      const hex = String(mp.color || "#C2572B").replace("#", "");
      return "enc=" + encodeURIComponent(mp.enc) + "&c=" + encodeURIComponent(hex);
    })
    .join("&");
  if(!params) return null;

  // Framing computed client-side from the drawn points, so the image is
  // zoomed to the fence line rather than Google's looser auto-fit.
  let view = "";
  const v = p.map_view;
  if(v && typeof v.center === "string" && Number.isFinite(Number(v.zoom))){
    view = `&center=${encodeURIComponent(v.center)}&zoom=${Math.round(Number(v.zoom))}`;
  }

  return `https://${host}/.netlify/functions/map-image?${params}${view}`;
}

// Pulls the PNG down server-side so it can ride along as a real attachment on
// the lead email — that way it's visible even if the inline image is blocked.
async function fetchMapPngBase64(mapUrl){
  if(!mapUrl) return null;
  try{
    const res = await fetch(mapUrl);
    if(!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch(e){
    return null;
  }
}

async function sendBrevoEmail({ to, toName, subject, html, attachments }) {
  const body = {
    sender: SENDER,
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent: html,
  };
  const valid = (attachments || []).filter(a => a && a.content && a.name);
  if(valid.length){
    body.attachment = valid.map(a => ({ content: a.content, name: a.name }));
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: responseBody };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const host = event.headers.host || event.headers.Host || "lafencecalculator.com";
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

  if (!p.email || !p.name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields: name, email" }) };
  }

  const results = {};

  // 1. Client quote email
  try {
    results.clientEmail = await sendBrevoEmail({
      to: p.email,
      toName: p.name,
      subject: `Your Fence Estimate: ${p.estimate_low} – ${p.estimate_high} — Let's schedule your visit!`,
      html: buildClientEmailHtml(p, host),
    });
  } catch (e) {
    results.clientEmail = { ok: false, error: String(e) };
  }

  // 2. Owner alert email — carries the yard photo and the traced map as real
  //    attachments, so they're available even if inline images are blocked.
  try {
    const ownerAttachments = [];
    const photos = Array.isArray(p.photos) ? p.photos.slice(0, 4) : [];
    photos.forEach((ph, i) => {
      if(ph && ph.content){
        ownerAttachments.push({ content: ph.content, name: ph.name || `yard-photo-${i + 1}.jpg` });
      }
    });
    const mapPng = await fetchMapPngBase64(buildMapImageUrl(p, host));
    if (mapPng) {
      ownerAttachments.push({ content: mapPng, name: "fence-map.png" });
    }
    results.ownerEmail = await sendBrevoEmail({
      to: p.owner_email || OWNER_EMAIL,
      toName: "LA Fence Craft",
      subject: `New Lead: ${p.name} — ${p.estimate_low}–${p.estimate_high}`,
      html: buildOwnerEmailHtml(p, host),
      attachments: ownerAttachments,
    });
  } catch (e) {
    results.ownerEmail = { ok: false, error: String(e) };
  }

  // Automated SMS is intentionally not sent — US carriers require an approved
  // A2P/toll-free registration for that. Instead the lead email carries a
  // one-tap "Text this customer" link so Nick can send a real person-to-person
  // text from his own phone, which needs no registration.

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, results }),
  };
};
