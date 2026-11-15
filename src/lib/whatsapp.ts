// Server-only Cloud API transport. Never import this module from a client component.
import { validateIdentifier } from "./contact-validation";

export function whatsappConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";
  const template = process.env.WHATSAPP_INVITATION_TEMPLATE || "";
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
  const hostIds = (process.env.WHATSAPP_HOST_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  let origin = "";
  try {
    const url = new URL(process.env.MEMORICA_PUBLIC_URL || "");
    if (url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.|\[|10\.|192\.168\.)/i.test(url.hostname)) origin = url.origin;
  } catch { /* Not configured yet. */ }
  const missing = [
    !token && "Meta access token", !/^\d+$/.test(phoneNumberId) && "Phone Number ID",
    !/^v\d+\.0$/.test(version) && "API version", !/^[a-z0-9_]+$/.test(template) && "approved invitation template",
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) && "template language",
    !origin && "public HTTPS Memorica address", !hostIds.length && "authorized sending account",
  ].filter(Boolean) as string[];
  return {token,phoneNumberId,version,template,language,hostIds,origin,missing};
}
export function invitationPayload(input: {phone:string;name:string;title:string;url:string}, config = whatsappConfig()) {
  const phone = validateIdentifier(input.phone, "phone").slice(1);
  // Template contract: three positional BODY parameters, no header or buttons.
  const text = (value:string) => value.replace(/\s+/g, " ").trim();
  return {messaging_product:"whatsapp",to:phone,type:"template",template:{name:config.template,language:{code:config.language},components:[{type:"body",parameters:[input.name,input.title,input.url].map(value=>({type:"text",text:text(value)}))}]}};
}
export class WhatsAppSendError extends Error {
  constructor(message:string, public uncertain = false) { super(message); }
}
export async function sendWhatsAppInvitation(input: {phone:string;name:string;title:string;url:string}, transport: typeof fetch = fetch) {
  const config = whatsappConfig();
  if (config.missing.length) throw new WhatsAppSendError("WhatsApp setup is incomplete.");
  let response: Response;
  try {
    response = await transport(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method:"POST",headers:{Authorization:`Bearer ${config.token}`,"Content-Type":"application/json"},
      body:JSON.stringify(invitationPayload(input, config)),signal:AbortSignal.timeout(15000),
    });
  } catch { throw new WhatsAppSendError("Meta’s response could not be confirmed. Check WhatsApp before trying again to avoid a duplicate.", true); }
  const data = await response.json().catch(()=>null);
  if (!response.ok) {
    const code = Number(data?.error?.code);
    const messages:Record<number,string> = {
      190:"The Meta access token has expired or is invalid. Update the local configuration.",
      131030:"This number is not an allowed Meta test recipient. Add and verify it in Meta’s test setup.",
      132001:"The invitation template or language is unavailable. Check its approval in Meta.",
      132000:"The template parameters do not match. Use the documented three-variable invitation template.",
      131047:"Meta requires an approved template for this invitation.",
      130429:"WhatsApp is rate limited. Please wait before trying again.",
    };
    throw new WhatsAppSendError(messages[code] || `Meta rejected the message${Number.isFinite(code)?` (code ${code})`:""}. Check the WhatsApp account configuration.`);
  }
  const id = data?.messages?.[0]?.id;
  if (typeof id !== "string" || !id) throw new WhatsAppSendError("Meta’s response did not include a message ID. Check before resending.", true);
  return id;
}
