"use client";
import { useCallback, useEffect, useState } from "react";
import { GuestDTO, WeddingDTO } from "@/lib/types";
import { invitationOptions } from "@/lib/event-setup";
import { MediaPreview } from "./EventSetupForm";
type Delivery = {guestId:string;invitationKey:string;status:string;error:string|null};
type Connection = {ready:boolean;missing:string[];deliveries:Delivery[]};
export default function WhatsAppInvitations({wedding,guests,onSent}:{wedding:WeddingDTO;guests:GuestDTO[];onSent:()=>Promise<void>}) {
  const [connection,setConnection] = useState<Connection|null>(null);
  const [guestId,setGuestId] = useState("");
  const [invitationKey,setInvitationKey] = useState("");
  const [consent,setConsent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [review,setReview] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState(false);
  const choices = invitationOptions(wedding);
  const guest = guests.find(g=>g.id===guestId);
  const choice = choices.find(o=>o.key===invitationKey);
  const prior = connection?.deliveries.find(d=>d.guestId===guestId&&d.invitationKey===invitationKey);
  const blocked = Boolean(prior && prior.status!=="failed");
  const refresh = useCallback(async()=>{
    const response = await fetch(`/api/weddings/${wedding.id}/whatsapp`,{cache:"no-store"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load WhatsApp connection.");
    setConnection(data);
  },[wedding.id]);
  useEffect(()=>{refresh().catch(e=>{setNotice(e.message);setError(true);});},[refresh]);
  async function send() {
    if (!guest || !choice || !consent || busy) return;
    setBusy(true);setNotice("");setError(false);
    try {
      const response = await fetch(`/api/weddings/${wedding.id}/whatsapp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guestId:guest.id,invitationKey:choice.key,consentConfirmed:true})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send invitation.");
      setNotice(data.message);setReview(false);setConsent(false);
      await onSent();
    } catch(e) {setError(true);setNotice(e instanceof Error?e.message:"The send could not be confirmed. Refresh before retrying.");}
    finally {await refresh().catch(()=>{});setBusy(false);}
  }
  const field = "w-full rounded-xl border border-stone-300 bg-white p-3 mt-1";
  return <section className="rounded-2xl border border-emerald-200 bg-white p-6 space-y-4">
    <h2 className="font-serif text-xl font-bold">Send through Memorica WhatsApp</h2>
    <p className="text-sm text-stone-600">Send a personal invitation directly from Memorica’s business number. The message links to your selected event or sub-event card.</p>
    {!connection ? <p className="text-sm">Checking WhatsApp connection…</p> : !connection.ready ? <div className="rounded-xl bg-amber-50 p-4 text-sm"><strong>Connection setup needed</strong><p className="mt-1">Still needed: {connection.missing.join(", ")}. You can continue using the regular WhatsApp share button meanwhile.</p></div> : <p className="text-sm text-emerald-700">WhatsApp is configured for this account.</p>}
    <button type="button" disabled={busy} className="text-sm underline text-emerald-800" onClick={()=>refresh().catch(e=>{setNotice(e.message);setError(true);})}>Refresh connection and send status</button>
    <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium">Guest<select className={field} disabled={busy} value={guestId} onChange={e=>{setGuestId(e.target.value);setConsent(false);setReview(false);setInvitationKey(guests.find(g=>g.id===e.target.value)?.invitationKey||"");}}><option value="">Choose a guest</option>{guests.map(g=><option key={g.id} value={g.id} disabled={!g.phone}>{g.name}{g.phone?` · ${g.phone}`:" · phone number needed"}</option>)}</select></label>
    <label className="text-sm font-medium">Invitation card<select className={field} disabled={busy} value={invitationKey} onChange={e=>{setInvitationKey(e.target.value);setReview(false);}}><option value="">Choose an event</option>{choices.map(o=><option key={o.key} value={o.key}>{o.title}</option>)}</select></label></div>
    {!guests.length && <p className="text-sm text-stone-600">Add guests with phone numbers in Invite Contacts first.</p>}
    {prior && <p className="rounded-xl bg-stone-50 p-3 text-sm">Previous send: <strong>{prior.status==="accepted"?"Accepted by WhatsApp; delivery not confirmed":prior.status}</strong>{prior.error&&` — ${prior.error}`}</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>This guest agreed to receive event invitations from Memorica on WhatsApp.</span></label>
    <button type="button" disabled={!connection?.ready||!guest?.phone||!choice||!consent||busy||blocked} className="rounded-xl px-4 py-3 bg-emerald-700 text-white font-semibold disabled:opacity-40" onClick={()=>setReview(true)}>Review WhatsApp invitation</button>
    {review && guest && choice && <div role="dialog" aria-modal="true" aria-label="Confirm WhatsApp invitation" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto space-y-4">
      <h3 className="font-semibold text-lg">Send to {guest.name}?</h3><p className="text-sm">Recipient: {guest.phone}</p>
      <div className="rounded-xl bg-emerald-50 p-4 text-sm">Hi {guest.name}, you’re invited to {choice.title}. View your invitation and RSVP: <span className="underline">[personal invitation link]</span></div>
      <MediaPreview asset={choice.card}/><p className="text-xs text-stone-500">The card is available through the invitation link. Meta’s approved template controls the final message wording.</p>
      <div className="flex gap-3"><button type="button" disabled={busy} onClick={()=>setReview(false)} className="border rounded-xl px-4 py-2">Cancel</button><button type="button" disabled={busy||blocked||!consent||!connection?.ready} onClick={send} className="rounded-xl px-4 py-2 bg-emerald-700 text-white disabled:opacity-40">{busy?"Sending…":"Send WhatsApp invitation"}</button></div>
      {notice&&<p role={error?"alert":"status"} className="text-sm">{notice}</p>}
    </div></div>}
    {notice&&<p role={error?"alert":"status"} className={`text-sm ${error?"text-red-700":"text-emerald-800"}`}>{notice}</p>}
  </section>;
}
