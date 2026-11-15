import * as media from "@/lib/routes/media/route";
import { NextRequest, NextResponse } from "next/server";
import * as authOtp from "@/lib/routes/auth/otp/route";
import * as authSession from "@/lib/routes/auth/session/route";
import * as authGoogle from "@/lib/routes/auth/google/route";
import * as authGoogleCallback from "@/lib/routes/auth/google/callback/route";
import * as weddingsRoot from "@/lib/routes/weddings/route";
import * as weddingDetail from "@/lib/routes/weddings/[id]/route";
import * as weddingGuests from "@/lib/routes/weddings/[id]/guests/route";
import * as weddingUpdates from "@/lib/routes/weddings/[id]/updates/route";
import * as inviteSlug from "@/lib/routes/invite/[slug]/route";

export const dynamic = "force-dynamic";

async function dispatch(
  req: NextRequest,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  segments: string[]
) {
  const [p0, p1, p2] = segments;

  if (p0 === "media" && p1 && segments.length === 2 && method === "GET") return media.read(p1);
  if (p0 === "weddings" && p1 && p2 === "media" && segments.length === 3 && method === "POST") return media.upload(req, p1);

  if (p0 === "auth" && p1 === "avatar" && segments.length === 2 && method === "GET") return authSession.avatar();

  // /api/auth/otp
  if (p0 === "auth" && p1 === "otp" && segments.length === 2) {
    if (method === "POST") return authOtp.POST(req);
  }

  // /api/auth/session
  if (p0 === "auth" && p1 === "session" && segments.length === 2) {
    if (method === "GET") return authSession.GET();
    if (method === "POST") return authSession.POST(req);
    if (method === "PATCH") return authSession.PATCH(req);
    if (method === "DELETE") return authSession.DELETE();
  }

  // /api/auth/google
  if (p0 === "auth" && p1 === "google" && segments.length === 2) {
    if (method === "GET") return authGoogle.GET(req);
  }

  // /api/auth/google/callback
  if (
    p0 === "auth" &&
    p1 === "google" &&
    p2 === "callback" &&
    segments.length === 3
  ) {
    if (method === "GET") return authGoogleCallback.GET(req);
  }

  // /api/weddings
  if (p0 === "weddings" && segments.length === 1) {
    if (method === "GET") return weddingsRoot.GET();
    if (method === "POST") return weddingsRoot.POST(req);
  }

  // /api/weddings/[id]
  if (p0 === "weddings" && p1 && segments.length === 2) {
    if (method === "GET") return weddingDetail.GET(req, { params: { id: p1 } });
    if (method === "PATCH")
      return weddingDetail.PATCH(req, { params: { id: p1 } });
    if (method === "DELETE")
      return weddingDetail.DELETE(req, { params: { id: p1 } });
  }

  // /api/weddings/[id]/guests
  if (p0 === "weddings" && p1 && p2 === "guests" && segments.length === 3) {
    if (method === "GET") return weddingGuests.GET(req, { params: { id: p1 } });
    if (method === "POST")
      return weddingGuests.POST(req, { params: { id: p1 } });
    if (method === "PATCH")
      return weddingGuests.PATCH(req, { params: { id: p1 } });
  }

  // /api/weddings/[id]/updates
  if (p0 === "weddings" && p1 && p2 === "updates" && segments.length === 3) {
    if (method === "GET")
      return weddingUpdates.GET(req, { params: { id: p1 } });
    if (method === "POST")
      return weddingUpdates.POST(req, { params: { id: p1 } });
    if (method === "PATCH")
      return weddingUpdates.PATCH(req, { params: { id: p1 } });
    if (method === "DELETE")
      return weddingUpdates.DELETE(req, { params: { id: p1 } });
  }

  // /api/invite/[slug]
  if (p0 === "invite" && p1 && segments.length === 2) {
    if (method === "GET") return inviteSlug.GET(req, { params: { slug: p1 } });
    if (method === "POST")
      return inviteSlug.POST(req, { params: { slug: p1 } });
  }

  return NextResponse.json({ error: "API route not found" }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return dispatch(req, "GET", params.path || []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return dispatch(req, "POST", params.path || []);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return dispatch(req, "PATCH", params.path || []);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return dispatch(req, "DELETE", params.path || []);
}
