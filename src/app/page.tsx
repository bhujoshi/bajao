"use client";

import DateInput from "@/components/DateInput";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { groupHostedEvents } from "@/lib/event-status";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  encodeUserHintHeader,
  formatWeddingDateRange,
} from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookUser,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Heart,
  Lock,
  MapPin,
  Plus,
  Share2,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const {
    user,
    hostedWeddings,
    invitedWeddings,
    loading,
    openAuthModal,
    refreshAuth,
  } = useAuth();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [eventType, setEventType] = useState("Wedding");
  const [otherEventType, setOtherEventType] = useState("");
  const [coupleNames, setCoupleNames] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Host Onboarding / Profile Verification State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null | undefined>(undefined);
  const [photoReading, setPhotoReading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !editingProfile) { setProfileName(user.name); setProfilePhone(user.phone || ""); }
  }, [user, editingProfile]);
  const eventGroups = groupHostedEvents(hostedWeddings);
  async function choosePhoto(file?: File) {
    if (!file) return;
    setPhotoReading(true); setProfileError(null);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 10 MB.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 320;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare this photo.");
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 320, 320);
      bitmap.close(); setProfilePhoto(canvas.toDataURL("image/jpeg", 0.85));
    } catch (error) { setProfileError(error instanceof Error ? error.message : "Could not read this photo."); }
    finally {setPhotoReading(false);}
  }

  const handleCreateWedding = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const startObj = new Date(date);
      const endObj = new Date(endDate);
      if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
        throw new Error(
          "Please select both start (From) and end (To) date."
        );
      }
      if (endObj.getTime() < startObj.getTime()) {
        throw new Error(
          "The end date (To) must be on or after the start date (From)."
        );
      }

      const res = await fetch("/api/weddings", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          eventType,
          otherEventType,
          coupleNames,
          eventTitle,
          date: startObj.toISOString(),
          endDate: endObj.toISOString(),
          venue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }
      await refreshAuth();
      setCreateModalOpen(false);
      sessionStorage.setItem(`memorica-created-${data.wedding.id}`, "true");
      router.push(`/host/weddings/${data.wedding.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create event"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          profilePhoto,
          name: profileName,
          phone: profilePhone,
          onboardingCompleted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }
      await refreshAuth();
      setEditingProfile(false);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to save profile"
      );
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
        <p className="text-sm text-stone-500">Loading your workspace...</p>
      </div>
    );
  }

  // Unauthenticated Product Landing Page
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14 space-y-14">
        <section className="relative overflow-hidden rounded-3xl bg-royal-header text-white p-8 sm:p-14 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Event Invitations & Live Guest Updates</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              A shared home for every memorable event.
            </h1>
            <p className="text-sm sm:text-base text-rose-100 leading-relaxed">
              Create your event, build your guest list from your
              contacts, share personalized invitations, collect RSVPs effortlessly,
              and publish real-time event updates exclusively for your verified
              guests.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  openAuthModal({
                    title: "Create an Event or Sign In",
                    subtitle:
                      "Verify your email or phone to start hosting or view your invitations.",
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-rose-900 shadow-md hover:bg-rose-50 transition"
              >
                Get Started as Host
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  openAuthModal({
                    title: "Guest Sign In",
                    subtitle:
                      "Verify the email or phone number from your event invitation to view live event updates.",
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/25 transition"
              >
                Guest Sign In
              </button>
            </div>
          </div>
        </section>

        {/* Core Product Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <BookUser className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Smart Guest List & Contact Import
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Import selected contacts from your mobile device or CSV/vCard
              files with automatic duplicate detection—or add guests manually at
              any time. Importing never sends invitations without your action.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Share2 className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Frictionless Invitations & RSVPs
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Share your event link or personalized guest links via WhatsApp,
              SMS, or email. Guests can open the invitation and submit their
              RSVP (Yes, No, or Maybe) immediately without creating an account
              first.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Private Live Updates for Verified Guests
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Publish live schedule announcements, shuttle timings, and venue
              notes. Server-enforced access control ensures only verified guests
              of your event can view private updates.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // Authenticated User Dashboard (Host & Guest)
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Host Onboarding / Profile Completion Banner */}
      {(!user.onboardingCompleted || editingProfile) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                {user.onboardingCompleted ? "Your account" : "Account Onboarding & Profile Verification"}
              </span>
              <h2 className="font-serif text-xl font-bold text-stone-900 mt-0.5">
                {user.onboardingCompleted ? "Edit your profile" : "Complete Your Host & Guest Profile"}
              </h2>
              <p className="text-xs text-stone-600">
                Confirm your display name and optional phone number so your
                hosted events and any guest invitations link automatically.
              </p>
            </div>
            {user.onboardingCompleted && (
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Cancel
              </button>
            )}
          </div>

          {profileError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
              {profileError}
            </div>
          )}

          <form
            onSubmit={handleSaveProfile}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full bg-rose-100 flex items-center justify-center text-2xl font-bold text-rose-800">
                {(profilePhoto === undefined ? user.avatarUrl : profilePhoto) ? <img src={(profilePhoto === undefined ? user.avatarUrl : profilePhoto)!} alt="Profile photo preview" className="h-full w-full object-cover" /> : user.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold">Profile picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoReading || profileSaving} onChange={e=>{void choosePhoto(e.target.files?.[0]); e.target.value="";}} className="block mt-2 text-xs"/></label>
                <p className="text-xs text-stone-500">JPG, PNG or WebP · up to 10 MB · cropped to a square</p>
                <button type="button" onClick={()=>setProfilePhoto(null)} className="text-xs text-rose-700 underline">Remove photo</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Arjun Kapoor"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mobile Phone Number (Optional)
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving || photoReading}
              className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
            >
              {profileSaving ? "Saving..." : user.onboardingCompleted ? "Save profile" : "Save & Complete Onboarding"}
            </button>
          </form>
        </div>
      )}

      {/* Profile Summary Strip */}
      {user.onboardingCompleted && !editingProfile && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-800 font-bold text-base">
              {user.avatarUrl ? <img src={user.avatarUrl} alt={`${user.name} profile photo`} className="h-full w-full rounded-2xl object-cover" /> : user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-stone-900">
                  {user.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Account
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {user.email && <span>Email: {user.email}</span>}
                {user.email && user.phone && <span> • </span>}
                {user.phone ? (
                  <span>Phone: {user.phone}</span>
                ) : (
                  <span className="text-stone-400">No phone number added</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setProfilePhoto(undefined);
              setProfileError(null);
              setProfileName(user.name);
              setProfilePhone(user.phone || "");
              setEditingProfile(true);
            }}
            className="self-start sm:self-auto rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
          >
            Edit Profile / Contact Info
          </button>
        </div>
      )}

      {/* Hosted events grouped by their inclusive calendar date range. */}
      {eventGroups.map(group => <section key={group.id} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-rose-700" />
              {group.title}
            </h2>
            <p className="text-xs text-stone-500">
              {group.description}
            </p>
          </div>
          {group.id === "ongoing" && group.events.length > 0 && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 self-start rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 transition"
            >
              <Plus className="h-4 w-4" />
              Create an Event
            </button>
          )}
        </div>

        {group.events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <Heart className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-stone-900">
                {group.id === "ongoing" ? "No ongoing event right now" : group.id === "upcoming" ? "No upcoming events" : "Your event history starts here"}
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                {group.id === "past" ? "Events appear here after their end date, with guest lists and memories available to revisit." : "Create an event, complete its details, and invite your contacts to join."}
              </p>
            </div>
            {group.id === "ongoing" && <div className="pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 transition"
              >
                <Plus className="h-4 w-4" />
                Create an Event
              </button>
            </div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {group.events.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm hover:border-rose-300 transition space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
                        Host
                      </span>
                      {w.stats.conflictCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                          <AlertTriangle className="h-3 w-3" />
                          {w.stats.conflictCount} Guest Conflict Needs Review
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-stone-900">
                      {w.eventType === "Wedding" ? `${w.coupleNames} — ${w.eventTitle}` : w.eventTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                        <span>
                          {formatWeddingDateRange(w.date, w.endDate)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                        {w.venue}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      href={`/host/weddings/${w.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 transition"
                    >
                      Manage Event
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/invite/${w.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
                    >
                      Invitation Page
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2 border-t border-stone-100">
                  <div className="rounded-xl bg-stone-50 p-3 border border-stone-200/60">
                    <div className="text-[11px] text-stone-500">
                      Total Guests
                    </div>
                    <div className="text-lg font-bold text-stone-900">
                      {w.stats.totalGuests}
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 p-3 border border-emerald-200/60">
                    <div className="text-[11px] text-emerald-700 font-medium">
                      RSVP: Yes
                    </div>
                    <div className="text-lg font-bold text-emerald-900">
                      {w.stats.yesCount}
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-200/60">
                    <div className="text-[11px] text-amber-700 font-medium">
                      RSVP: Maybe
                    </div>
                    <div className="text-lg font-bold text-amber-900">
                      {w.stats.maybeCount}
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-50/70 p-3 border border-rose-200/60">
                    <div className="text-[11px] text-rose-700 font-medium">
                      RSVP: No
                    </div>
                    <div className="text-lg font-bold text-rose-900">
                      {w.stats.noCount}
                    </div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3 border border-stone-200/60">
                    <div className="text-[11px] text-stone-500">
                      Registered Guests
                    </div>
                    <div className="text-lg font-bold text-stone-900">
                      {w.stats.registeredGuests}
                    </div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3 border border-stone-200/60">
                    <div className="text-[11px] text-stone-500">
                      Published Updates
                    </div>
                    <div className="text-lg font-bold text-stone-900">
                      {w.stats.updatesCount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>)}

      {/* Invited Weddings Section */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Events You Are Invited To
          </h2>
          <p className="text-xs text-stone-500">
            Events linked to your verified email or phone number.
          </p>
        </div>

        {invitedWeddings.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center space-y-1.5">
            <p className="text-sm font-medium text-stone-700">
              No event invitations are linked to your account yet.
            </p>
            <p className="text-xs text-stone-500">
              When a wedding host adds your email or phone number to their guest
              list—or when you open a shared event invitation link and verify
              your account—it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invitedWeddings.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Invited Guest
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      RSVP:{" "}
                      <strong
                        className={
                          w.myRsvpStatus === "yes"
                            ? "text-emerald-700"
                            : w.myRsvpStatus === "no"
                            ? "text-rose-700"
                            : w.myRsvpStatus === "maybe"
                            ? "text-amber-700"
                            : "text-stone-700"
                        }
                      >
                        {w.myRsvpStatus}
                      </strong>
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    {w.eventType === "Wedding" ? `${w.coupleNames} — ${w.eventTitle}` : w.eventTitle}
                  </h3>
                  <p className="text-xs text-stone-600 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                    <span>{formatWeddingDateRange(w.date, w.endDate)}</span>
                  </p>
                  <p className="text-xs text-stone-600 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                    {w.venue}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100">
                  <Link
                    href={`/events/${w.slug}/updates`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 transition"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    View Live Updates ({w.updatesCount})
                  </Link>
                  <Link
                    href={
                      w.myInviteToken
                        ? `/invite/${w.slug}?guest=${w.myInviteToken}`
                        : `/invite/${w.slug}`
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
                  >
                    View Invitation / Update RSVP
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Event Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Create an Event
                </h3>
                <p className="text-xs text-stone-500">
                  Enter your celebration schedule and venue details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWedding} className="space-y-3.5">
              <label className="block text-xs font-semibold text-stone-700">Event Type *
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 p-3 bg-white">
                  {["Office outing", "Conference meeting", "Wedding", "Other"].map(type => <option key={type}>{type}</option>)}
                </select>
              </label>
              {eventType === "Other" && <label className="block text-xs font-semibold">Name your event type *<input required value={otherEventType} onChange={e => setOtherEventType(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>}
              <p className="text-xs text-stone-500">Step 1 of 2 · Create your event, then complete its details and invitation.</p>
              {eventType === "Wedding" && <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Couple Names *
                </label>
                <input
                  type="text"
                  required
                  placeholder={eventType === "Wedding" ? "e.g. Arjun & Meera" : "Organizer name"}
                  value={coupleNames}
                  onChange={(e) => setCoupleNames(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                />
              </div>}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wedding Ceremony & Reception"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    From (Start Date) *
                  </label>
                  <DateInput
                    type="date"
                    required
                    value={date}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDate(val);
                      if (val && (!endDate || endDate < val)) {
                        setEndDate(val);
                      }
                    }}
                    className="block w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    To (End Date) *
                  </label>
                  <DateInput
                    type="date"
                    required
                    min={date || undefined}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Oberoi Udaivilas, Udaipur"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-rose-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
