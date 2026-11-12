"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  RsvpStatus,
  encodeUserHintHeader,
  formatDateTimeStamp,
} from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Lock,
  MapPin,
  Sparkles,
  UserCheck,
} from "lucide-react";

interface PublicWeddingData {
  id: string;
  slug: string;
  coupleNames: string;
  eventTitle: string;
  date: string;
  endDate?: string | null;
  venue: string;
  description?: string | null;
}

interface PersonalizedGuestData {
  id: string;
  name: string;
  email: string;
  phone: string;
  inviteToken: string;
  rsvpStatus: RsvpStatus;
  rsvpNote: string;
  rsvpUpdatedAt?: string | null;
  isLinkedToUser: boolean;
}

function PublicWeddingInvitationContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const guestTokenParam = searchParams.get("guest") || undefined;

  const { user, openAuthModal, refreshAuth } = useAuth();

  const [wedding, setWedding] = useState<PublicWeddingData | null>(null);
  const [personalizedGuest, setPersonalizedGuest] =
    useState<PersonalizedGuestData | null>(null);
  const [viewerAccess, setViewerAccess] = useState<{
    isAuthenticated: boolean;
    role: "host" | "guest" | "none";
    canViewUpdates: boolean;
    canManage: boolean;
    publishedUpdatesCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>("yes");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rsvpNote, setRsvpNote] = useState("");
  const [activeInviteToken, setActiveInviteToken] = useState<
    string | undefined
  >(guestTokenParam);

  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [rsvpResult, setRsvpResult] = useState<{
    status: RsvpStatus;
    resolutionType: "updated_existing" | "created_new" | "flagged_conflict";
    message: string;
  } | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  const loadInvitation = useCallback(async () => {
    setLoading(true);
    try {
      const query = guestTokenParam
        ? `?guest=${encodeURIComponent(guestTokenParam)}`
        : "";
      const res = await fetch(`/api/invite/${params.slug}${query}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          ...encodeUserHintHeader(user),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setNotFoundError(data.error || "Invitation not found");
        return;
      }

      setWedding(data.wedding);
      setViewerAccess(data.viewerAccess);

      if (data.personalizedGuest) {
        const pg: PersonalizedGuestData = data.personalizedGuest;
        setPersonalizedGuest(pg);
        setActiveInviteToken(pg.inviteToken);
        setGuestName(pg.name);
        setGuestEmail(pg.email || user?.email || "");
        setGuestPhone(pg.phone || user?.phone || "");
        if (pg.rsvpStatus !== "pending") {
          setRsvpStatus(pg.rsvpStatus);
        }
        setRsvpNote(pg.rsvpNote || "");
      } else if (user) {
        setGuestName((prev) => prev || user.name);
        setGuestEmail((prev) => prev || user.email || "");
        setGuestPhone((prev) => prev || user.phone || "");
      }
    } catch {
      setNotFoundError("Could not load wedding invitation.");
    } finally {
      setLoading(false);
    }
  }, [params.slug, guestTokenParam, user]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  const handleSubmitRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wedding) return;
    setSubmittingRsvp(true);
    setRsvpError(null);

    try {
      const res = await fetch(`/api/invite/${wedding.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guestName,
          email: guestEmail || undefined,
          phone: guestPhone || undefined,
          rsvpStatus,
          rsvpNote: rsvpNote || undefined,
          inviteToken: activeInviteToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit RSVP");
      }

      setActiveInviteToken(data.guest.inviteToken);
      setPersonalizedGuest({
        id: data.guest.id,
        name: data.guest.name,
        email: data.guest.email || "",
        phone: data.guest.phone || "",
        inviteToken: data.guest.inviteToken,
        rsvpStatus: data.guest.rsvpStatus,
        rsvpNote: data.guest.rsvpNote || "",
        rsvpUpdatedAt: data.guest.rsvpUpdatedAt,
        isLinkedToUser: Boolean(user),
      });

      if (data.resolutionType === "flagged_conflict") {
        setRsvpResult({
          status: rsvpStatus,
          resolutionType: "flagged_conflict",
          message:
            "Your RSVP response was safely recorded. Since another guest record with matching contact information already responded under a different name, the host has been notified to review and merge your response.",
        });
      } else {
        setRsvpResult({
          status: rsvpStatus,
          resolutionType: data.resolutionType,
          message:
            data.resolutionType === "updated_existing"
              ? `Thank you, ${data.guest.name}! Your RSVP (${rsvpStatus.toUpperCase()}) has been updated.`
              : `Thank you, ${data.guest.name}! Your RSVP (${rsvpStatus.toUpperCase()}) has been recorded.`,
        });
      }

      await refreshAuth();
    } catch (err) {
      setRsvpError(
        err instanceof Error ? err.message : "Failed to submit RSVP"
      );
    } finally {
      setSubmittingRsvp(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
        <p className="text-sm text-stone-600">Opening Wedding Invitation...</p>
      </div>
    );
  }

  if (notFoundError || !wedding) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm space-y-3">
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Invitation Not Found
          </h1>
          <p className="text-xs text-stone-600">
            {notFoundError ||
              "This wedding invitation link may be invalid or no longer active."}
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = new Date(wedding.date);
  const daysAway = Math.max(
    0,
    Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="min-h-screen bg-wedding-gradient py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {personalizedGuest && (
          <div className="rounded-2xl bg-white/90 border border-rose-200 px-4 py-3 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-800 font-bold text-xs">
                {personalizedGuest.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">
                  Personal Invitation for {personalizedGuest.name}
                </div>
                <div className="text-[11px] text-stone-500">
                  RSVP Status:{" "}
                  <strong className="uppercase text-rose-700">
                    {personalizedGuest.rsvpStatus}
                  </strong>
                </div>
              </div>
            </div>
            {viewerAccess?.canManage && (
              <Link
                href={`/host/weddings/${wedding.id}`}
                className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-200"
              >
                Manage Event →
              </Link>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-rose-200/80 bg-white shadow-xl">
          <div className="bg-royal-header px-6 py-10 sm:px-10 sm:py-12 text-center text-white space-y-4 relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-200">
              <Sparkles className="h-3 w-3" />
              Together With Their Families
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
              {wedding.coupleNames}
            </h1>

            <p className="font-serif text-lg sm:text-xl text-rose-100 italic">
              {wedding.eventTitle}
            </p>

            <div className="pt-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3.5 py-1 text-xs font-medium text-rose-100">
                <Clock className="h-3.5 w-3.5 text-amber-300" />
                {daysAway > 0
                  ? `${daysAway} days until the celebration`
                  : "Celebration Day"}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {wedding.description && (
              <p className="text-center font-serif text-sm sm:text-base text-stone-700 leading-relaxed italic max-w-lg mx-auto">
                &ldquo;{wedding.description}&rdquo;
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-rose-50/50 border border-rose-100 p-4 flex items-start gap-3">
                <div className="rounded-xl bg-rose-100 p-2.5 text-rose-800 shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    Event Schedule (From — To)
                  </div>
                  <div className="text-xs sm:text-sm text-stone-900">
                    <span className="font-semibold text-stone-500">From: </span>
                    <span className="font-bold">
                      {formatDateTimeStamp(wedding.date)}
                    </span>
                  </div>
                  {wedding.endDate && (
                    <div className="text-xs sm:text-sm text-stone-900">
                      <span className="font-semibold text-stone-500">To: </span>
                      <span className="font-bold">
                        {formatDateTimeStamp(wedding.endDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-4 flex items-start gap-3">
                <div className="rounded-xl bg-amber-100 p-2.5 text-amber-800">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Venue
                  </div>
                  <div className="text-sm font-bold text-stone-900 mt-0.5">
                    {wedding.venue}
                  </div>
                </div>
              </div>
            </div>

            {/* RSVP Card */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    RSVP Response
                  </span>
                  <h2 className="font-serif text-xl font-bold text-stone-900">
                    {personalizedGuest &&
                    personalizedGuest.rsvpStatus !== "pending"
                      ? "Update Your RSVP"
                      : "Will You Celebrate With Us?"}
                  </h2>
                </div>
              </div>

              {rsvpResult && (
                <div
                  className={`rounded-xl border p-4 text-xs space-y-2 ${
                    rsvpResult.resolutionType === "flagged_conflict"
                      ? "border-amber-300 bg-amber-50 text-amber-950"
                      : "border-emerald-300 bg-emerald-50 text-emerald-950"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {rsvpResult.resolutionType === "flagged_conflict" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                    <div className="font-medium leading-relaxed">
                      {rsvpResult.message}
                    </div>
                  </div>
                </div>
              )}

              {rsvpError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {rsvpError}
                </div>
              )}

              <form onSubmit={handleSubmitRsvp} className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        value: "yes" as RsvpStatus,
                        title: "Yes",
                        sub: "Joyfully Attending",
                        activeClass:
                          "border-emerald-600 bg-emerald-600 text-white shadow-sm",
                      },
                      {
                        value: "maybe" as RsvpStatus,
                        title: "Maybe",
                        sub: "Tentative",
                        activeClass:
                          "border-amber-600 bg-amber-600 text-white shadow-sm",
                      },
                      {
                        value: "no" as RsvpStatus,
                        title: "No",
                        sub: "Warm Regards",
                        activeClass:
                          "border-rose-700 bg-rose-700 text-white shadow-sm",
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = rsvpStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRsvpStatus(opt.value)}
                        className={`rounded-xl border p-3 text-center transition ${
                          selected
                            ? opt.activeClass
                            : "border-stone-200 bg-white text-stone-800 hover:border-rose-300"
                        }`}
                      >
                        <div className="text-sm font-bold">{opt.title}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            selected ? "text-white/90" : "text-stone-500"
                          }`}
                        >
                          {opt.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98111 22233"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Note for the Couple (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Share a message or travel details..."
                    value={rsvpNote}
                    onChange={(e) => setRsvpNote(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingRsvp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-3 text-xs font-semibold text-white shadow-md hover:bg-rose-800 disabled:opacity-50 transition"
                >
                  <Heart className="h-4 w-4 fill-current" />
                  {submittingRsvp
                    ? "Saving Your RSVP..."
                    : personalizedGuest &&
                      personalizedGuest.rsvpStatus !== "pending"
                    ? "Update RSVP"
                    : "Submit RSVP"}
                </button>
              </form>
            </div>

            {/* Guest Registration & Live Event Updates Section */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-700 p-2.5 text-white shrink-0 mt-0.5">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-900">
                      Live Event Updates
                    </h3>
                    <span className="rounded-full bg-white border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                      {viewerAccess?.publishedUpdatesCount || 0} Updates
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    Schedule announcements, shuttle timings, and venue updates
                    published by the host are accessible to registered guests of{" "}
                    <strong>{wedding.coupleNames}</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                {viewerAccess?.canViewUpdates ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white p-3.5 border border-emerald-200">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      Verified Guest Access ({user?.email || user?.phone})
                    </div>
                    <Link
                      href={`/events/${wedding.slug}/updates`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                    >
                      View Live Event Updates
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white p-3.5 border border-rose-200">
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                      <Lock className="h-4 w-4 text-rose-700 shrink-0" />
                      <span>
                        Verify your contact details to link your RSVP and view
                        live updates
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openAuthModal({
                          title: "Register & Verify for Live Event Updates",
                          subtitle:
                            "Verify your email or phone number to access live wedding updates.",
                          claimInviteToken: activeInviteToken,
                          prefillName: guestName,
                          prefillEmail: guestEmail,
                          prefillPhone: guestPhone,
                          onSuccess: () => {
                            router.push(`/events/${wedding.slug}/updates`);
                          },
                        })
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 transition shrink-0"
                    >
                      Verify Account & View Updates
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicWeddingInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-3">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
          <p className="text-sm text-stone-600">Opening Wedding Invitation...</p>
        </div>
      }
    >
      <PublicWeddingInvitationContent />
    </Suspense>
  );
}
