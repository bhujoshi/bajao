"use client";

import { missingEventDetails } from "@/lib/event-setup";
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

  const [dashboardView, setDashboardView] = useState("ongoing");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [eventType, setEventType] = useState("Wedding");
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
    <div className="celebration-dashboard mx-auto max-w-6xl px-4 py-5 sm:py-8 space-y-6">
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

      {user.onboardingCompleted && !editingProfile && <section className="dashboard-welcome">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-rose-100 font-serif text-xl text-rose-800 shadow-sm">{user.avatarUrl ? <img src={user.avatarUrl} alt="Your profile" className="h-full w-full rounded-full object-cover"/> : user.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0"><p className="text-xs text-rose-700">A little planning. A lot of memories.</p><h1 className="font-serif text-2xl sm:text-3xl truncate">Hello, {user.name.split(" ")[0]}</h1></div>
        </div>
        <button type="button" onClick={()=>{setProfilePhoto(undefined);setProfileError(null);setProfileName(user.name);setProfilePhone(user.phone || "");setEditingProfile(true);}} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-rose-800 underline underline-offset-4">Edit profile <CheckCircle2 size={14}/><span className="font-normal text-stone-500 no-underline">Verified account</span></button>
        <Heart className="welcome-flower" aria-hidden="true"/>
      </section>}
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700">YOUR MEMORIES START HERE</p><h2 className="font-serif text-2xl sm:text-3xl">My celebrations</h2></div><button type="button" onClick={()=>setCreateModalOpen(true)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><Plus size={17}/>Create event</button></div>
      <div role="group" aria-label="Event groups" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...eventGroups.map(group=>({id:group.id,title:group.id==='past'?'Previously hosted':group.id==='ongoing'?'Ongoing':'Upcoming',count:group.events.length,icon:group.id==='ongoing'?Sparkles:group.id==='upcoming'?Calendar:Heart})),{id:'invited',title:'Invited to',count:invitedWeddings.length,icon:BookUser}].map(group=>{const Icon=group.icon;return <button type="button" key={group.id} aria-pressed={dashboardView===group.id} onClick={()=>setDashboardView(group.id)} className={`event-widget ${dashboardView===group.id?'is-active':''}`}><div className="flex items-center justify-between"><span className="widget-icon"><Icon size={19}/></span><span className="font-serif text-3xl">{group.count}</span></div><span className="mt-3 block text-sm font-semibold">{group.title}</span><span className="mt-0.5 block text-[11px] opacity-75">{group.id==='ongoing'?'Happening now':group.id==='upcoming'?'Looking forward':group.id==='past'?'Memories to revisit':'You’re on the guest list'}</span></button>})}
      </div>
      <section aria-live="polite" className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl">{dashboardView==='invited'?'Your invitations':eventGroups.find(group=>group.id===dashboardView)?.title}</h2><span className="text-xs text-stone-500">{dashboardView==='invited'?invitedWeddings.length:eventGroups.find(group=>group.id===dashboardView)?.events.length} events</span></div>
        {dashboardView==='invited' ? invitedWeddings.length ? invitedWeddings.map(w=><article key={w.id} className="celebration-card"><span className="text-[10px] uppercase tracking-wider text-rose-700">YOU’RE INVITED · RSVP: {w.myRsvpStatus}</span><h3 className="font-serif text-2xl mt-2">{w.coupleNames || w.eventTitle}</h3><p className="text-sm text-stone-500 mt-2">{formatWeddingDateRange(w.date,w.endDate)} · {w.venue}</p><div className="mt-5 flex flex-wrap gap-3"><Link className="card-primary" href={w.myInviteToken?`/invite/${w.slug}?guest=${w.myInviteToken}`:`/invite/${w.slug}`}>View invitation & RSVP <ArrowRight size={16}/></Link><Link className="card-secondary" href={`/events/${w.slug}/updates`}>Live updates</Link></div></article>) : <div className="celebration-empty"><BookUser size={26}/><h3>Your next invitation awaits</h3><p>Events you’re invited to will appear here.</p></div> : (()=>{const group=eventGroups.find(item=>item.id===dashboardView)!;return group.events.length ? group.events.map(w=>{const remaining=missingEventDetails(w);return <article key={w.id} className="celebration-card"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-rose-700"><Heart size={12}/> Wedding <span className="ml-auto rounded-full bg-rose-50 px-2.5 py-1">{remaining.length?'Setup in progress':group.id==='past'?'Memories saved':'Ready to celebrate'}</span></div><h3 className="font-serif text-2xl sm:text-3xl mt-3">{w.coupleNames || w.eventTitle}</h3>{w.coupleNames&&<p className="text-xs text-stone-500 mt-1">{w.eventTitle}</p>}<div className="mt-4 space-y-2 text-sm text-stone-600"><p className="flex items-start gap-2"><Calendar size={16} className="shrink-0 text-rose-600 mt-0.5"/>{formatWeddingDateRange(w.date,w.endDate)}</p><p className="flex items-start gap-2"><MapPin size={16} className="shrink-0 text-rose-600 mt-0.5"/>{w.venue}</p></div><div className="mt-4 border-t border-rose-100 pt-3 text-xs text-stone-500">{w.stats.totalGuests} guests · {w.stats.yesCount} attending{w.stats.conflictCount>0&&` · ${w.stats.conflictCount} conflicts to review`}</div><div className="mt-4 flex flex-wrap gap-3"><Link className="card-primary" href={`/host/weddings/${w.id}`}>{remaining.length?'Continue setup':'Manage event'}<ArrowRight size={16}/></Link>{!remaining.length&&<Link className="card-secondary" href={`/invite/${w.slug}`}>View invitation</Link>}</div></article>}) : <div className="celebration-empty"><Heart size={26}/><h3>{group.id==='ongoing'?'A little quiet, for now':group.id==='upcoming'?'Something lovely to look forward to':'Beautiful memories belong here'}</h3><p>{group.id==='past'?'Your hosted celebrations will be saved here.':'Start planning your next celebration.'}</p><button type="button" className="card-primary mx-auto mt-4" onClick={()=>setCreateModalOpen(true)}><Plus size={16}/>Create an event</button></div>})()}
      </section>

      {/* Create Event Modal */}
      {createModalOpen && (
        <div className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/40 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="sheet-panel w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#ffffff] p-5 sm:p-6 shadow-2xl border border-rose-100 space-y-4">
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
                  <option value="Wedding">Wedding</option>
                </select>
              </label>
              <p className="text-xs text-stone-500">Step 1 of 2 · Create your event, then complete its details and invitation.</p>

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
