import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapWeddingToDTO } from "@/lib/db";
import { missingEventDetails } from "@/lib/event-setup";
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "application/pdf"];
function detectedType(data: Buffer): string | null {
  if (data.subarray(0, 3).equals(Buffer.from([255,216,255]))) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (["GIF87a", "GIF89a"].includes(data.toString("ascii",0,6))) return "image/gif";
  if (data.toString("ascii",0,4) === "RIFF" && data.toString("ascii",8,12) === "WEBP") return "image/webp";
  if (data.toString("ascii",0,5) === "%PDF-") return "application/pdf";
  if (data.toString("ascii",4,8) === "ftyp") return "video/mp4";
  if (data.subarray(0,4).equals(Buffer.from([26,69,223,163]))) return "video/webm";
  return null;
}
export async function upload(req: NextRequest, weddingId: string) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) return NextResponse.json({error: "Please sign in."}, {status:401});
  const wedding = await prisma.wedding.findFirst({where:{id:weddingId, ownerUserId:user.id}});
  if (!wedding) return NextResponse.json({error:"Event not found."}, {status:404});
  if (Number(req.headers.get("content-length")) > 21 * 1024 * 1024) return NextResponse.json({error:"Maximum file size is 20 MB."},{status:413});
  try {
    const form = await req.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 20*1024*1024 || !TYPES.includes(file.type)) return NextResponse.json({error:"Choose a JPG, PNG, WebP, GIF, MP4, WebM or PDF under 20 MB."},{status:400});
    const data = Buffer.from(await file.arrayBuffer());
    if (detectedType(data) !== file.type) return NextResponse.json({error:"The file contents do not match its format."},{status:400});
    const asset = await prisma.eventAsset.create({data:{weddingId, name:file.name.slice(0,255), mime:file.type, data},select:{id:true,name:true,mime:true}});
    return NextResponse.json({asset}, {status:201});
  } catch { return NextResponse.json({error:"Could not upload this file. Try again."},{status:400}); }
}
export async function read(id: string) {
  const asset = await prisma.eventAsset.findUnique({where:{id},include:{wedding:true}});
  if (!asset) return new NextResponse("Not found",{status:404});
  const user = await getAuthenticatedUserFromCookies();
  const wedding = mapWeddingToDTO(asset.wedding);
  const attached = wedding.setup.card?.id === id || wedding.setup.photos.some(p => p.id === id) || wedding.setup.subEvents.some(sub => sub.card?.id === id);
  if (user?.id !== wedding.ownerUserId && (!attached || missingEventDetails(wedding).length)) return new NextResponse("Not found",{status:404});
  return new NextResponse(new Uint8Array(asset.data),{headers:{"Content-Type":asset.mime,"X-Content-Type-Options":"nosniff","Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,"Cache-Control":"private, no-store"}});
}
