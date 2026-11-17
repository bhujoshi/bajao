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
  return {token,phoneNumberId,version,template,language,hostIds,origin,missing,weddingTemplate:template === "memorica_wedding_celebration"};
}
export function invitationPayload(input: {phone:string;name:string;title:string;url:string;groomName?:string;brideName?:string}, config = whatsappConfig()) {
  const phone = validateIdentifier(input.phone, "phone").slice(1);
  // Template contract: three positional BODY parameters, no header or buttons.
  const text = (value:string) => value.replace(/\s+/g, " ").trim();
  if (config.weddingTemplate && (!input.groomName?.trim() || !input.brideName?.trim())) throw new Error("Add the groom’s and bride’s names in event details before sending.");
  const parameters = config.weddingTemplate ? [input.groomName!,input.brideName!,input.url] : [input.name,input.title,input.url];
  return {messaging_product:"whatsapp",to:phone,type:"template",template:{name:config.template,language:{code:config.language},components:[{type:"body",parameters:parameters.map(value=>({type:"text",text:text(value)}))}]}};
}
export class WhatsAppSendError extends Error {
  constructor(message:string, public uncertain = false) { super(message); }
}
export async function sendWhatsAppInvitation(input: {phone:string;name:string;title:string;url:string;groomName?:string;brideName?:string}, transport: typeof fetch = fetch) {
  const config = whatsappConfig();
  if (config.missing.length) throw new WhatsAppSendError("WhatsApp setup is incomplete.");
  return sendPayload(invitationPayload(input, config), config, transport);
}
export function whatsappTestRecipients(): string[] {
  if (process.env.NODE_ENV !== "development") return [];
  return (process.env.WHATSAPP_TEST_RECIPIENTS || "").split(",").map(s=>s.trim()).filter(Boolean).map(s=>validateIdentifier(s,"phone"));
}
export async function sendWhatsAppSample(phone:string, transport:typeof fetch = fetch) {
  const config = whatsappConfig();
  const normalized = validateIdentifier(phone,"phone");
  if (!whatsappTestRecipients().includes(normalized)) throw new WhatsAppSendError("Choose a configured local test recipient.");
  if (!config.token || !/^\d+$/.test(config.phoneNumberId) || !/^v\d+\.0$/.test(config.version)) throw new WhatsAppSendError("Configure the Meta token and test sender first.");
  return sendPayload({messaging_product:"whatsapp",to:normalized.slice(1),type:"template",template:{name:"hello_world",language:{code:"en_US"}}},config,transport);
}
async function sendPayload(payload:unknown,config:ReturnType<typeof whatsappConfig>,transport:typeof fetch) {
  let response: Response;
  try {
    response = await transport(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method:"POST",headers:{Authorization:`Bearer ${config.token}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),
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
