import { NextRequest, NextResponse } from "next/server";
import { createDatabaseSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { upsertVerifiedUser } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const rawState = req.nextUrl.searchParams.get("state") || "";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/auth/google/callback`;

  let returnTo = "/";
  let claimInviteToken: string | undefined;
  try {
    const parsedState = JSON.parse(
      Buffer.from(rawState, "base64url").toString("utf-8")
    );
    if (parsedState.returnTo) returnTo = parsedState.returnTo;
    if (parsedState.claimInviteToken)
      claimInviteToken = parsedState.claimInviteToken;
  } catch {
    if (rawState.startsWith("/")) returnTo = rawState;
  }

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error("Failed to exchange Google OAuth code");
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    if (!userRes.ok) {
      throw new Error("Failed to fetch Google user profile");
    }

    const profile = await userRes.json();
    const { user } = await upsertVerifiedUser({
      name: profile.name || profile.email,
      email: profile.email,
      googleSub: profile.sub,
      avatarUrl: profile.picture,
      claimInviteToken,
    });

    const { rawToken, expiresAt } = await createDatabaseSession(user.id);
    const response = NextResponse.redirect(new URL(returnTo, req.url));
    response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }
}
