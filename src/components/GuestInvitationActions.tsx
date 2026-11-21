"use client";

import { useState } from "react";
import { GuestDTO, WeddingDTO } from "@/lib/types";
import { invitationOptions } from "@/lib/event-setup";
import { MediaPreview } from "./EventSetupForm";

export default function GuestInvitationActions({ wedding, guests, onCompleted }: {
  wedding: WeddingDTO;
  guests: GuestDTO[];
  onCompleted: (guestIds: string[]) => Promise<void>;
}) {
  const [action, setAction] = useState<"copy" | "send" | null>(null);
  const [invitationKey, setInvitationKey] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const choices = invitationOptions(wedding);
  const choice = choices.find(item => item.key === invitationKey);
  const missingPhone = guests.some(guest => !guest.phone);

  function open(next: "copy" | "send") {
    setInvitationKey(""); setConsent(false); setNotice(""); setAction(next);
  }
  async function complete() {
    if (!choice || !guests.length || busy || (action === "send" && (!consent || missingPhone))) return;
    setBusy(true); setNotice("");
    const completed: string[] = [];
    const failures: string[] = [];
    try {
      if (action === "copy") {
        const links = guests.map(guest => {
          const url = new URL(`/invite/${wedding.slug}`, window.location.origin);
          url.searchParams.set("invitation", choice.key);
          url.searchParams.set("guest", guest.inviteToken);
          return guests.length === 1 ? url.toString() : `${guest.name}: ${url}`;
        });
        await navigator.clipboard.writeText(links.join("\n"));
      }
      for (const guest of guests) {
        try {
          const response = await fetch(`/api/weddings/${wedding.id}/${action === "send" ? "whatsapp" : "guests"}`, {
            method: action === "send" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action === "send"
              ? { guestId: guest.id, invitationKey: choice.key, consentConfirmed: true }
              : { action: "mark_shared", guestId: guest.id, invitationKey: choice.key, channel: "copy" }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to complete this invitation.");
          completed.push(guest.id);
        } catch (error) {
          failures.push(`${guest.name}: ${error instanceof Error ? error.message : "Could not confirm the result. Check before retrying."}`);
        }
      }
      const result = action === "send"
        ? `${completed.length} invitation(s) accepted by WhatsApp. Delivery is not yet confirmed.`
        : `Copied ${guests.length} personal invitation link(s).`;
      setNotice([result, ...failures].join("\n"));
      // Keep failed recipients selected; accepted sends are never retried by this dialog.
      await onCompleted(completed);
      if (!failures.length) setAction(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to complete this action.");
    } finally { setBusy(false); }
  }

  return <>
    {guests.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <span className="text-sm font-semibold">{guests.length} guest(s) selected</span>
      <button type="button" disabled={busy} onClick={() => open("send")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Share invitation</button>
      <button type="button" disabled={busy} onClick={() => open("copy")} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Copy link{guests.length > 1 ? "s" : ""}</button>
    </div>}
    {notice && !action && <p role="status" className="whitespace-pre-line text-sm text-emerald-800">{notice}</p>}
    {action && <div role="dialog" aria-modal="true" aria-label="Choose invitation for selected guests" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">Which invitation would you like to {action === "send" ? "send" : "copy"}?</h2>
        <p className="text-sm text-stone-600">{action === "send" ? "Send directly from Memorica’s WhatsApp business number to" : "Create personal invitation links for"} {guests.length} selected guest(s).</p>
        <ul className="max-h-32 overflow-y-auto text-sm text-stone-600">{guests.map(guest => <li key={guest.id}>{guest.name} · {guest.phone || "No mobile number"}</li>)}</ul>
        <label className="block text-sm font-medium">Event or sub-event invitation<select disabled={busy} value={invitationKey} onChange={e => {setInvitationKey(e.target.value); setConsent(false);}} className="mt-2 w-full rounded-xl border border-stone-300 bg-white p-3">
          <option value="">Choose an invitation</option>{choices.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}
        </select></label>
        {choice && <><MediaPreview asset={choice.card}/>{action === "send" && <p className="text-sm text-stone-600">The approved wedding message includes {wedding.setup.groomName} &amp; {wedding.setup.brideName} and each guest’s personal link to this invitation card.</p>}</>}
        {action === "send" && <>
          {missingPhone && <p role="alert" className="text-sm text-red-700">Every selected guest needs a mobile number before sending.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/><span>These guests agreed to receive event invitations from Memorica on WhatsApp.</span></label>
        </>}
        {notice && <p role="status" className="whitespace-pre-line text-sm text-stone-700">{notice}</p>}
        <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => setAction(null)} className="rounded-xl border px-4 py-2">Cancel</button><button type="button" onClick={() => {void complete();}} disabled={busy || !choice || !guests.length || (action === "send" && (!consent || missingPhone))} className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Processing…" : action === "send" ? "Send invitation" : "Copy personal links"}</button></div>
      </div>
    </div>}
  </>;
}
