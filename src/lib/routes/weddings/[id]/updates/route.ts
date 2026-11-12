import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth";
import {
  createEventUpdate,
  editEventUpdate,
  getWeddingAccess,
  mapUpdateToDTO,
  removeEventUpdate,
  trackAnalyticsEvent,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { UpdateCategory } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json(
      {
        error:
          "Please sign in and verify your account to access live wedding updates.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding) {
    return NextResponse.json(
      { error: "Wedding event not found." },
      { status: 404 }
    );
  }

  if (!access.canViewUpdates) {
    return NextResponse.json(
      {
        error:
          "Access Denied: Your account is not on the invitation list for this wedding. Live event updates are restricted to verified guests and the event host.",
        code: "FORBIDDEN_NOT_INVITED",
        weddingSummary: {
          id: access.wedding.id,
          slug: access.wedding.slug,
          coupleNames: access.wedding.coupleNames,
          eventTitle: access.wedding.eventTitle,
        },
      },
      { status: 403 }
    );
  }

  const updateRows = await prisma.eventUpdate.findMany({
    where: {
      weddingId: access.wedding.id,
      publicationStatus: "published",
    },
    include: {
      author: { select: { name: true } },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  if (access.role === "guest") {
    await trackAnalyticsEvent({
      weddingId: access.wedding.id,
      eventType: "guest_viewed_updates",
      actorRole: "guest",
      summary: "Registered guest viewed live event updates",
      metadata: {
        updateCount: updateRows.length,
      },
    });
  }

  return NextResponse.json({
    wedding: access.wedding,
    role: access.role,
    canManage: access.canManage,
    guestRecord: access.guestRecord,
    updates: updateRows.map(mapUpdateToDTO),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding) {
    return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json(
      {
        error:
          "Forbidden: Guests have read-only access and cannot publish event updates.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { textContent, category, isPinned } = body as {
      textContent?: string;
      category?: UpdateCategory;
      isPinned?: boolean;
    };

    const update = await createEventUpdate({
      weddingId: access.wedding.id,
      authorUserId: user.id,
      textContent: textContent || "",
      category,
      isPinned,
    });

    return NextResponse.json({ update }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to publish update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding || !access.canManage) {
    return NextResponse.json(
      {
        error:
          "Forbidden: Only the wedding host can edit published event updates.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { updateId, textContent, category, isPinned } = body as {
      updateId: string;
      textContent?: string;
      category?: UpdateCategory;
      isPinned?: boolean;
    };

    const update = await editEventUpdate({
      weddingId: access.wedding.id,
      updateId,
      authorUserId: user.id,
      textContent,
      category,
      isPinned,
    });

    return NextResponse.json({ update });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to edit update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getWeddingAccess(params.id, user.id);
  if (!access.wedding || !access.canManage) {
    return NextResponse.json(
      {
        error:
          "Forbidden: Only the wedding host can remove published event updates.",
      },
      { status: 403 }
    );
  }

  try {
    const updateId = req.nextUrl.searchParams.get("updateId");
    if (!updateId) {
      return NextResponse.json(
        { error: "updateId is required" },
        { status: 400 }
      );
    }

    await removeEventUpdate({
      weddingId: access.wedding.id,
      updateId,
      authorUserId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
