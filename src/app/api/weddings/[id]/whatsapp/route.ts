import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import { getWeddingAccess } from "@/lib/db";
import { invitationOptions, missingEventDetails } from "@/lib/event-setup";
import { prisma } from "@/lib/prisma";
import { validateIdentifier } from "@/lib/contact-validation";
import { sendWhatsAppInvitation, whatsappConfig, WhatsAppSendError, whatsappTestRecipients } from "@/lib/whatsapp";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function accessFor(id:string) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return null;
  const access = await getWeddingAccess(id,user.id);
  return access.canManage && access.wedding ? {user,wedding:access.wedding} : null;
}
export async function GET(_req:NextRequest,{params}:{params:{id:string}}) {
  const access = await accessFor(params.id);
  if (!access) return NextResponse.json({error:"Only the event owner can view WhatsApp settings."},{status:403});
  const config = whatsappConfig();
  const enabled = config.hostIds.includes(access.user.id);
  const connectionReady = !config.missing.length && enabled;
  const connectionMissing = enabled
    ? config.missing
    : [...config.missing.filter(m => m !== "authorized sending account"), "authorization for this sending account"];
  const weddingMissing = config.weddingTemplate ? (access.wedding.eventType !== "Wedding" ? ["a wedding event for the configured template"] : !access.wedding.setup.groomName.trim() || !access.wedding.setup.brideName.trim() ? ["groom and bride names in event details"] : []) : [];
  const missing = [...connectionMissing,...weddingMissing];
  const deliveries = await prisma.whatsAppInvitation.findMany({where:{guest:{weddingId:access.wedding.id}},select:{guestId:true,invitationKey:true,status:true,error:true,updatedAt:true}});
  return NextResponse.json({testRecipients:whatsappTestRecipients(),weddingTemplate:config.weddingTemplate,connectionReady,connectionMissing,weddingMissing,ready:!missing.length && enabled,missing,deliveries});
}
export async function POST(req:NextRequest,{params}:{params:{id:string}}) {
  const access = await accessFor(params.id);
  if (!access) return NextResponse.json({error:"Only the event owner can send invitations."},{status:403});
  const config = whatsappConfig();
  if (config.missing.length || !config.hostIds.includes(access.user.id)) return NextResponse.json({error:"WhatsApp sending is not configured for this account yet."},{status:503});
  if (missingEventDetails(access.wedding).length) return NextResponse.json({error:"Complete the event and invitation details first."},{status:400});
  if (config.weddingTemplate && (access.wedding.eventType !== "Wedding" || !access.wedding.setup.groomName.trim() || !access.wedding.setup.brideName.trim())) return NextResponse.json({error:"This template requires a wedding event with groom and bride names saved in event details."},{status:400});
  try {
    const body = await req.json();
    if (body.consentConfirmed !== true || typeof body.guestId !== "string" || typeof body.invitationKey !== "string") return NextResponse.json({error:"Select a guest and invitation, and confirm their permission to receive WhatsApp messages."},{status:400});
    const guest = await prisma.guest.findFirst({where:{id:body.guestId,weddingId:access.wedding.id}});
    const choice = invitationOptions(access.wedding).find(o=>o.key===body.invitationKey);
    if (!guest || !choice) return NextResponse.json({error:"Guest or invitation not found."},{status:404});
    const phone = validateIdentifier(guest.phone || "","phone");
    const url = new URL(`/invite/${access.wedding.slug}`,config.origin);
    url.searchParams.set("guest",guest.inviteToken);url.searchParams.set("invitation",choice.key);
    // Atomic unique reservation prevents a double click or retry from sending twice.
    let delivery;
    try {
      delivery = await prisma.whatsAppInvitation.create({data:{guestId:guest.id,invitationKey:choice.key,recipient:phone,consentAt:new Date()}});
    } catch (error) {
      if ((error as {code?:string}).code !== "P2002") throw error;
      const previous = await prisma.whatsAppInvitation.findUnique({where:{guestId_invitationKey:{guestId:guest.id,invitationKey:choice.key}}});
      if (!previous || previous.status !== "failed") return NextResponse.json({error:previous?.status==="accepted"?"This invitation has already been accepted by WhatsApp.":"An earlier send is pending or unconfirmed. Check before sending again."},{status:409});
      const claimed = await prisma.whatsAppInvitation.updateMany({where:{id:previous.id,status:"failed"},data:{status:"sending",error:null,recipient:phone,consentAt:new Date()}});
      if (!claimed.count) return NextResponse.json({error:"Another send is in progress."},{status:409});
      delivery = previous;
    }
    let messageId:string;
    try { messageId = await sendWhatsAppInvitation({phone,name:guest.name,title:choice.title,groomName:access.wedding.setup.groomName,brideName:access.wedding.setup.brideName,url:url.toString()}); }
    catch (error) {
      const known = error instanceof WhatsAppSendError;
      const message = known ? error.message : "The send result could not be confirmed. Check before resending.";
      await prisma.whatsAppInvitation.update({where:{id:delivery.id},data:{status:known&&!error.uncertain?"failed":"unconfirmed",error:message}});
      return NextResponse.json({error:message},{status:502});
    }
    await prisma.$transaction([
      prisma.whatsAppInvitation.update({where:{id:delivery.id},data:{status:"accepted",messageId,error:null}}),
      prisma.guest.update({where:{id:guest.id},data:{invitationKey:choice.key,...(guest.invitationStatus==="not_shared"?{invitationStatus:"link_shared"}:{})}}),
    ]);
    return NextResponse.json({status:"accepted",message:"WhatsApp accepted the invitation. Delivery is not yet confirmed."});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error && /country code|phone number/.test(error.message)?error.message:"Could not process this invitation. Refresh the status before retrying."},{status:400});
  }
}
