import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import { getWeddingAccess } from "@/lib/db";
import { sendWhatsAppSample, WhatsAppSendError } from "@/lib/whatsapp";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const lastAttempts = new Map<string,number>();
export async function POST(req:NextRequest,{params}:{params:{id:string}}) {
  if (process.env.NODE_ENV !== "development" || !["127.0.0.1","localhost"].includes(req.nextUrl.hostname)) return NextResponse.json({error:"Local testing only."},{status:404});
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return NextResponse.json({error:"Open the local app to run this test."},{status:403});
  const user = await getAuthenticatedUserFromCookies();
  if (!user || !(await getWeddingAccess(params.id,user.id)).canManage) return NextResponse.json({error:"Only the event owner can run this test."},{status:403});
  try {
    const body = await req.json();
    if (typeof body.phone !== "string") return NextResponse.json({error:"Choose a test recipient."},{status:400});
    if (Date.now()-(lastAttempts.get(user.id)||0)<60000) return NextResponse.json({error:"Wait one minute before another sample test."},{status:429});
    lastAttempts.set(user.id,Date.now());
    await sendWhatsAppSample(body.phone);
    return NextResponse.json({status:"accepted",message:"Meta accepted the sample message. Check the selected phone’s WhatsApp for Hello World. Delivery is not yet confirmed."});
  } catch(error) {
    return NextResponse.json({error:error instanceof WhatsAppSendError?error.message:"Could not confirm the test send. Check WhatsApp before trying again."},{status:502});
  }
}
