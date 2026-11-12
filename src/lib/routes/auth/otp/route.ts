import { NextRequest, NextResponse } from "next/server";
import {
  createOtpChallenge,
  OTP_CHALLENGE_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, channel } = body as {
      identifier?: string;
      channel?: "email" | "phone";
    };

    if (!identifier) {
      return NextResponse.json(
        { error: "Please provide your email address or phone number." },
        { status: 400 }
      );
    }

    const selectedChannel =
      channel || (identifier.includes("@") ? "email" : "phone");

    const challenge = await createOtpChallenge({
      identifier,
      channel: selectedChannel,
    });

    const res = NextResponse.json({
      identifier: challenge.identifier,
      channel: challenge.channel,
      expiresInSeconds: challenge.expiresInSeconds,
      ...(challenge.devVerificationCode
        ? { devVerificationCode: challenge.devVerificationCode }
        : {}),
    });

    res.cookies.set(
      OTP_CHALLENGE_COOKIE_NAME,
      challenge.signedChallengeToken,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 600,
      }
    );

    return res;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not send verification code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
