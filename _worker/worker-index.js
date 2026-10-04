// Cloudflare Worker: receives the PersianPod questionnaire (POST /api/form)
// and emails it to your verified inbox through Cloudflare Email Routing.
// No third-party form service and no API key.
import { EmailMessage } from "cloudflare:email";

const FROM = "form@persianpod.ir";            // any address on persianpod.ir (Email Routing must be enabled)
const TO = "noysdc.media@gmail.com";   // the destination you verified in Email Routing
const MAX_BYTES = 200 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
const wrap = (b) => b.replace(/.{1,76}/g, "$&\r\n").trimEnd();
const clean = (s) => String(s).replace(/[\r\n]+/g, " ").trim();

function buildRaw({ subject, body, replyTo }) {
  const headers = [
    `From: ${b64word("پرشین‌پاد")} <${FROM}>`,
    `To: ${TO}`,
    `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@persianpod.ir>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (replyTo && /^\S+@\S+\.\S+$/.test(replyTo)) headers.push(`Reply-To: ${replyTo}`);
  return headers.join("\r\n") + "\r\n\r\n" + wrap(b64utf8(body)) + "\r\n";
}
function b64word(s) { return `=?UTF-8?B?${b64utf8(s)}?=`; }

// Tries the newer Email Service API first (what the dashboard binding shows),
// then falls back to the older EmailMessage API on the same EMAIL binding.
async function sendMail(env, { subject, body, replyTo, raw }) {
  try {
    const msg = { from: FROM, to: TO, subject, text: body };
    if (replyTo && /^\S+@\S+\.\S+$/.test(replyTo)) msg.replyTo = replyTo;
    await env.EMAIL.send(msg);
  } catch (e1) {
    try {
      await env.EMAIL.send(new EmailMessage(FROM, TO, raw));
    } catch (e2) {
      throw new Error("new API: " + (e1 && e1.message) + " | legacy API: " + (e2 && e2.message));
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/form") return new Response("Not found", { status: 404 });
    if (request.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return json({ success: false, message: "Too large" }, 413);

    let data;
    try { data = await request.json(); } catch { return json({ success: false, message: "Bad JSON" }, 400); }
    if (!data || typeof data !== "object") return json({ success: false, message: "Bad data" }, 400);

    // honeypot: bots tick the hidden box -> pretend success, send nothing
    if (data.botcheck) return json({ success: true });

    const skip = new Set(["access_key", "subject", "from_name", "botcheck"]);
    const body = Object.keys(data)
      .filter((k) => !skip.has(k) && String(data[k]).trim() !== "")
      .map((k) => `${clean(k)}:\n${String(data[k]).slice(0, 20000)}`)
      .join("\n\n");
    if (!body) return json({ success: false, message: "Empty" }, 400);
    if (body.length > MAX_BYTES) return json({ success: false, message: "Too large" }, 413);

    const subject = clean(data.subject || "پرسشنامه‌ی جدید معرفی پادکست — PersianPod");
    const raw = buildRaw({ subject, body, replyTo: clean(data.email || "") });

    try {
      await sendMail(env, { subject, body, replyTo: clean(data.email || ""), raw });
    } catch (e) {
      return json({ success: false, message: "Send failed", detail: String(e && e.message || e).slice(0, 300) }, 502);
    }
    return json({ success: true });
  },
};
