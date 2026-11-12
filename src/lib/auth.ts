import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { mapUserToDTO, normalizeEmail, normalizePhone } from "./db";
import { UserDTO, WeddingDTO } from "./types";

export const SESSION_COOKIE_NAME = "wm_prod_session";
export const OTP_CHALLENGE_COOKIE_NAME = "wm_otp_challenge";
export const WEDDINGS_BACKUP_COOKIE_NAME = "wm_weddings_backup";

const OTP_SECRET =
  process.env.SESSION_SECRET || "prod_wedding_memories_v2_hmac_secret_key";

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function signPayloadHmac(data: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(data)
    .digest("base64url");
}

function verifyPayloadHmac(data: string, signature: string): boolean {
  const expected = signPayloadHmac(data);
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(signature, "utf-8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashOtpCode(identifier: string, code: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${identifier}:${code.trim()}`)
    .digest("hex");
}

interface SignedSessionPayload {
  sid: string;
  user: UserDTO;
  exp: number;
}

async function ensureUserInDatabase(userDto: UserDTO) {
  let existing = await prisma.user.findUnique({ where: { id: userDto.id } });
  if (existing) return existing;

  const cleanEmail = normalizeEmail(userDto.email);
  const cleanPhone = normalizePhone(userDto.phone);

  if (cleanEmail) {
    existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) return existing;
  }
  if (cleanPhone) {
    existing = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (existing) return existing;
  }

  return prisma.user.create({
    data: {
      id: userDto.id,
      name: userDto.name || "Host",
      email: cleanEmail,
      phone: cleanPhone,
      avatarUrl: userDto.avatarUrl || null,
      googleSub: userDto.googleSub || null,
      accountStatus: userDto.accountStatus || "verified",
      onboardingCompleted: Boolean(userDto.onboardingCompleted),
    },
  });
}

export async function hydrateBackupWeddingsFromCookie(): Promise<void> {
  try {
    const cookieStore = cookies();
    const rawBackup = cookieStore.get(WEDDINGS_BACKUP_COOKIE_NAME)?.value;
    if (!rawBackup) return;

    const parts = rawBackup.split(".");
    if (parts.length !== 2) return;
    const [payloadB64, sig] = parts;
    if (!verifyPayloadHmac(payloadB64, sig)) return;

    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    ) as {
      user: UserDTO;
      weddings: WeddingDTO[];
    };

    if (!parsed?.user?.id || !Array.isArray(parsed.weddings)) return;

    const dbUser = await ensureUserInDatabase(parsed.user);

    for (const w of parsed.weddings) {
      if (!w.id || !w.slug) continue;
      const existingWedding = await prisma.wedding.findFirst({
        where: { OR: [{ id: w.id }, { slug: w.slug }] },
      });
      if (!existingWedding) {
        await prisma.wedding.create({
          data: {
            id: w.id,
            slug: w.slug,
            ownerUserId: dbUser.id,
            eventTitle: w.eventTitle,
            coupleNames: w.coupleNames,
            date: new Date(w.date),
            endDate: w.endDate ? new Date(w.endDate) : null,
            venue: w.venue,
            description: w.description || null,
          },
        });
        await prisma.eventMembership
          .upsert({
            where: {
              weddingId_userId: {
                weddingId: w.id,
                userId: dbUser.id,
              },
            },
            create: {
              weddingId: w.id,
              userId: dbUser.id,
              role: "host",
              membershipStatus: "active",
            },
            update: {
              role: "host",
              membershipStatus: "active",
            },
          })
          .catch(() => null);
      }
    }
  } catch {
    // Ignore backup cookie hydration errors
  }
}

export async function buildWeddingsBackupCookieValue(
  userId: string
): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const rows = await prisma.wedding.findMany({
      where: { ownerUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    const payload = {
      user: mapUserToDTO(user),
      weddings: rows.map((w) => ({
        id: w.id,
        slug: w.slug,
        ownerUserId: w.ownerUserId,
        eventTitle: w.eventTitle,
        coupleNames: w.coupleNames,
        date: w.date.toISOString(),
        endDate: w.endDate ? w.endDate.toISOString() : null,
        venue: w.venue,
        description: w.description,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString(
      "base64url"
    );
    const sig = signPayloadHmac(payloadB64);
    return `${payloadB64}.${sig}`;
  } catch {
    return null;
  }
}

export async function createDatabaseSession(userId: string): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const sid = crypto.randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  const userRecord = await prisma.user.findUnique({ where: { id: userId } });
  let rawToken = sid;

  if (userRecord) {
    const payload: SignedSessionPayload = {
      sid,
      user: mapUserToDTO(userRecord),
      exp: expiresAt.getTime(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString(
      "base64url"
    );
    const sig = signPayloadHmac(`${sid}.${payloadB64}`);
    rawToken = `${sid}.${payloadB64}.${sig}`;
  }

  const tokenHash = hashToken(rawToken);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export async function getAuthenticatedUserFromCookies(): Promise<UserDTO | null> {
  try {
    await hydrateBackupWeddingsFromCookie();

    const cookieStore = cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (session) {
        if (session.expiresAt.getTime() < Date.now()) {
          await prisma.session
            .delete({ where: { id: session.id } })
            .catch(() => null);
          return null;
        }
        return mapUserToDTO(session.user);
      }

      // Self-healing fallback for signed session cookies across serverless instances/cold starts
      const parts = rawToken.split(".");
      if (parts.length === 3) {
        const [sid, payloadB64, sig] = parts;
        if (verifyPayloadHmac(`${sid}.${payloadB64}`, sig)) {
          const parsed = JSON.parse(
            Buffer.from(payloadB64, "base64url").toString("utf-8")
          ) as SignedSessionPayload;

          if (parsed.exp > Date.now() && parsed.user?.id) {
            const restoredUser = await ensureUserInDatabase(parsed.user);
            await prisma.session
              .upsert({
                where: { tokenHash },
                create: {
                  tokenHash,
                  userId: restoredUser.id,
                  expiresAt: new Date(parsed.exp),
                },
                update: {
                  expiresAt: new Date(parsed.exp),
                },
              })
              .catch(() => null);

            return mapUserToDTO(restoredUser);
          }
        }
      }
    }

    // Fallback for pre-existing session tabs that supply x-wm-user-hint header
    const headerStore = headers();
    const userHintHeader = headerStore.get("x-wm-user-hint");
    if (userHintHeader) {
      const parsedUser = JSON.parse(
        Buffer.from(userHintHeader, "base64").toString("utf-8")
      ) as UserDTO;
      if (parsedUser?.id && (parsedUser.email || parsedUser.phone)) {
        const restoredUser = await ensureUserInDatabase(parsedUser);
        if (rawToken) {
          const tokenHash = hashToken(rawToken);
          await prisma.session
            .upsert({
              where: { tokenHash },
              create: {
                tokenHash,
                userId: restoredUser.id,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
              },
              update: {},
            })
            .catch(() => null);
        }
        return mapUserToDTO(restoredUser);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function revokeCurrentSession(): Promise<void> {
  try {
    const cookieStore = cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await prisma.session.deleteMany({ where: { tokenHash } });
  } catch {
    // Ignore errors during sign-out cleanup
  }
}

export async function createOtpChallenge(params: {
  identifier: string;
  channel: "email" | "phone";
}): Promise<{
  identifier: string;
  channel: "email" | "phone";
  expiresInSeconds: number;
  signedChallengeToken: string;
  devVerificationCode?: string;
}> {
  const cleanIdentifier =
    params.channel === "email"
      ? normalizeEmail(params.identifier)
      : normalizePhone(params.identifier);

  if (!cleanIdentifier) {
    throw new Error(
      params.channel === "email"
        ? "Please enter a valid email address."
        : "Please enter a valid phone number."
    );
  }

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashOtpCode(cleanIdentifier, code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate prior unconsumed codes for this identifier
  await prisma.otpVerification.deleteMany({
    where: {
      identifier: cleanIdentifier,
      channel: params.channel,
      consumedAt: null,
    },
  });

  await prisma.otpVerification.create({
    data: {
      identifier: cleanIdentifier,
      channel: params.channel,
      codeHash,
      expiresAt,
    },
  });

  const challengePayloadB64 = Buffer.from(
    JSON.stringify({
      identifier: cleanIdentifier,
      channel: params.channel,
      codeHash,
      exp: expiresAt.getTime(),
    }),
    "utf-8"
  ).toString("base64url");
  const challengeSig = signPayloadHmac(challengePayloadB64);
  const signedChallengeToken = `${challengePayloadB64}.${challengeSig}`;

  // Optional production email delivery via Resend API if RESEND_API_KEY is configured
  if (params.channel === "email" && process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.EMAIL_FROM ||
          "Wedding Memories <onboarding@resend.dev>",
        to: [cleanIdentifier],
        subject: `Your Wedding Memories verification code: ${code}`,
        html: `<p>Your verification code for <strong>Wedding Memories</strong> is:</p><h2 style="letter-spacing: 4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
      }),
    }).catch((e) => console.error("Resend email delivery error:", e));
  }

  const isLocalWithoutProvider =
    (params.channel === "email" && !process.env.RESEND_API_KEY) ||
    (params.channel === "phone" && !process.env.TWILIO_AUTH_TOKEN);

  if (isLocalWithoutProvider) {
    console.info(
      `[Wedding Memories Auth] Verification code for ${cleanIdentifier} (${params.channel}): ${code}`
    );
  }

  return {
    identifier: cleanIdentifier,
    channel: params.channel,
    expiresInSeconds: 600,
    signedChallengeToken,
    ...(isLocalWithoutProvider ? { devVerificationCode: code } : {}),
  };
}

export async function verifyOtpChallenge(params: {
  identifier: string;
  channel: "email" | "phone";
  code: string;
}): Promise<{ verifiedIdentifier: string }> {
  const cleanIdentifier =
    params.channel === "email"
      ? normalizeEmail(params.identifier)
      : normalizePhone(params.identifier);

  if (!cleanIdentifier) {
    throw new Error("Invalid email or phone identifier.");
  }

  const expectedHash = hashOtpCode(cleanIdentifier, params.code);

  const record = await prisma.otpVerification.findFirst({
    where: {
      identifier: cleanIdentifier,
      channel: params.channel,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (record) {
    if (record.expiresAt.getTime() < Date.now()) {
      throw new Error(
        "This verification code has expired. Please request a new code."
      );
    }

    if (record.attempts >= 5) {
      throw new Error(
        "Too many incorrect attempts. Please request a new verification code."
      );
    }

    const a = Buffer.from(record.codeHash, "hex");
    const b = Buffer.from(expectedHash, "hex");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error("Invalid verification code. Please check and try again.");
    }

    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return { verifiedIdentifier: cleanIdentifier };
  }

  // Fallback to signed OTP challenge cookie across serverless function instances
  const cookieStore = cookies();
  const signedToken = cookieStore.get(OTP_CHALLENGE_COOKIE_NAME)?.value;
  if (signedToken) {
    const parts = signedToken.split(".");
    if (parts.length === 2) {
      const [payloadB64, sig] = parts;
      if (verifyPayloadHmac(payloadB64, sig)) {
        const parsed = JSON.parse(
          Buffer.from(payloadB64, "base64url").toString("utf-8")
        ) as {
          identifier: string;
          channel: "email" | "phone";
          codeHash: string;
          exp: number;
        };

        if (parsed.exp < Date.now()) {
          throw new Error(
            "This verification code has expired. Please request a new code."
          );
        }

        if (
          parsed.identifier === cleanIdentifier &&
          parsed.channel === params.channel
        ) {
          const a = Buffer.from(parsed.codeHash, "hex");
          const b = Buffer.from(expectedHash, "hex");
          if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
            return { verifiedIdentifier: cleanIdentifier };
          }
          throw new Error(
            "Invalid verification code. Please check and try again."
          );
        }
      }
    }
  }

  throw new Error(
    "No active verification code found. Please request a new code."
  );
}
