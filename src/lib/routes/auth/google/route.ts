import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/auth/google/callback`;
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/";
  const claimInviteToken = req.nextUrl.searchParams.get("claimInviteToken") || "";

  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        `/login?notice=google_oauth_unconfigured&returnTo=${encodeURIComponent(
          returnTo
        )}`,
        req.url
      )
    );
  }

  const statePayload = JSON.stringify({ returnTo, claimInviteToken });
  const encodedState = Buffer.from(statePayload, "utf-8").toString("base64url");

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", encodedState);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(googleAuthUrl.toString());
}
