// netlify/functions/map-image.js
//
// Returns a satellite PNG of the customer's traced fence line(s).
//
// Why a proxy instead of linking Google directly from the email:
//   - The Static Maps key stays server-side. If it were in the email's
//     <img src>, anyone could pull it out of the message source.
//   - Email clients send no referrer, so a referrer-restricted key would
//     fail to load anyway.
//
// REQUIRED: Netlify env var STATIC_MAPS_API_KEY (Maps Static API enabled).

const STATIC_MAPS_API_KEY = process.env.STATIC_MAPS_API_KEY;

const MAX_PATHS = 8;          // matches the max number of drawn lines we expect
const MAX_ENC_LENGTH = 3000;  // a very long traced run, encoded
const DEFAULT_COLOR = "C2572B";

exports.handler = async (event) => {
  if (!STATIC_MAPS_API_KEY) {
    return { statusCode: 500, body: "Static maps key not configured" };
  }

  const q = event.multiValueQueryStringParameters || {};
  const encs = q.enc || [];
  const colors = q.c || [];

  if (!encs.length) return { statusCode: 400, body: "Missing path" };
  if (encs.length > MAX_PATHS) return { statusCode: 400, body: "Too many paths" };

  // Build one `path=` parameter per drawn line, keeping each line's colour.
  const parts = [];
  encs.forEach((enc, i) => {
    if (typeof enc !== "string" || !enc.length || enc.length > MAX_ENC_LENGTH) return;
    const hex = String(colors[i] || DEFAULT_COLOR).replace(/[^0-9A-Fa-f]/g, "").slice(0, 6) || DEFAULT_COLOR;
    parts.push(`color:0x${hex}ff|weight:5|enc:${enc}`);
  });

  if (!parts.length) return { statusCode: 400, body: "No valid paths" };

  // The caller computes the tightest framing that fits the drawing. Without
  // this, Google auto-fits with a lot of slack and the result reads as
  // zoomed-way-out for a typical residential run.
  const single = event.queryStringParameters || {};
  const center = String(single.center || "").match(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/) ? single.center : null;
  const zoomNum = parseInt(single.zoom, 10);
  const zoom = Number.isFinite(zoomNum) ? Math.max(1, Math.min(zoomNum, 21)) : null;

  const view = (center && zoom)
    ? `&center=${encodeURIComponent(center)}&zoom=${zoom}`
    : ""; // fall back to Google's auto-fit if framing wasn't supplied

  const url =
    "https://maps.googleapis.com/maps/api/staticmap" +
    "?size=600x360&scale=2&maptype=satellite" +
    view +
    parts.map((p) => "&path=" + encodeURIComponent(p)).join("") +
    "&key=" + STATIC_MAPS_API_KEY;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { statusCode: 502, body: `Map fetch failed (${res.status})` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/png",
        // Cache hard — the same lead's map never changes, so repeated email
        // opens don't cost extra Google calls.
        "Cache-Control": "public, max-age=2592000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 502, body: "Map fetch error: " + String(e) };
  }
};
