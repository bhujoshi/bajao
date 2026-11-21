"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GuestDTO, WeddingDTO, encodeUserHintHeader } from "@/lib/types";
import { invitationOptions } from "@/lib/event-setup";
import { MediaPreview } from "./EventSetupForm";
type Delivery = {guestId:string;invitationKey:string;status:string;error:string|null};
type Connection = {weddingTemplate?:boolean;testRecipients?:string[];ready:boolean;connectionReady?:boolean;connectionMissing?:string[];weddingMissing?:string[];missing:string[];deliveries:Delivery[]};
export default function WhatsAppInvitations({wedding,guests,onSent,onWeddingUpdated,onOpenSetup,initialGuestId=""}:{wedding:WeddingDTO;guests:GuestDTO[];onSent:()=>Promise<void>;onWeddingUpdated?:(wedding:WeddingDTO)=>void;onOpenSetup?:()=>void;initialGuestId?:string}) {
  const { user } = useAuth();
  const [connection,setConnection] = useState<Connection|null>(null);
  const [testPhone,setTestPhone] = useState("");
  const [groomName,setGroomName] = useState(wedding.setup.groomName);
  const [brideName,setBrideName] = useState(wedding.setup.brideName);
  const [savingNames,setSavingNames] = useState(false);
  const [guestId,setGuestId] = useState(initialGuestId);
  const [invitationKey,setInvitationKey] = useState(()=>{
    const assigned = guests.find(g=>g.id===initialGuestId)?.invitationKey;
    return invitationOptions(wedding).some(o=>o.key===assigned) ? assigned! : "";
  });
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
  useEffect(()=>{
    setGroomName(wedding.setup.groomName);
    setBrideName(wedding.setup.brideName);
  },[wedding.id,wedding.setup.groomName,wedding.setup.brideName]);
  const refresh = useCallback(async()=>{
    const response = await fetch(`/api/weddings/${wedding.id}/whatsapp`,{cache:"no-store",credentials:"same-origin",headers:{...encodeUserHintHeader(user)}});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load WhatsApp connection.");
    setConnection(data);
  },[wedding.id,wedding.eventType,wedding.setup.groomName,wedding.setup.brideName,user]);
  useEffect(()=>{refresh().catch(e=>{setNotice(e.message);setError(true);});},[refresh]);
  async function saveCoupleNames() {
    const cleanGroom = groomName.trim();
    const cleanBride = brideName.trim();
    if (!cleanGroom || !cleanBride) {
      setError(true);
      setNotice("Enter both the groom’s name and the bride’s name.");
      return;
    }
    if (busy || savingNames) return;
    setSavingNames(true);setNotice("");setError(false);
    try {
      const response = await fetch(`/api/weddings/${wedding.id}`,{
        method:"PATCH",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json",...encodeUserHintHeader(user)},
        body:JSON.stringify({groomName:cleanGroom,brideName:cleanBride}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save groom and bride names.");
      onWeddingUpdated?.(data.wedding);
      await refresh();
      setNotice("Groom and bride names saved. You can now review and send the WhatsApp invitation.");
    } catch(e) {setError(true);setNotice(e instanceof Error?e.message:"Could not save groom and bride names.");}
    finally {setSavingNames(false);}
  }
  async function send() {
    if (!guest || !choice || !consent || busy) return;
    setBusy(true);setNotice("");setError(false);
    try {
      const response = await fetch(`/api/weddings/${wedding.id}/whatsapp`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...encodeUserHintHeader(user)},body:JSON.stringify({guestId:guest.id,invitationKey:choice.key,consentConfirmed:true})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send invitation.");
      setNotice(data.message);setReview(false);setConsent(false);
      await onSent();
    } catch(e) {setError(true);setNotice(e instanceof Error?e.message:"The send could not be confirmed. Refresh before retrying.");}
    finally {await refresh().catch(()=>{});setBusy(false);}
  }
  async function sendSample() {
    if (!testPhone || busy) return;
    setBusy(true);setNotice("");setError(false);
    try {
      const response = await fetch(`/api/weddings/${wedding.id}/whatsapp/test`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...encodeUserHintHeader(user)},body:JSON.stringify({phone:testPhone})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sample send could not be confirmed.");
      setNotice(data.message);
    } catch(e) {setError(true);setNotice(e instanceof Error?e.message:"Sample send could not be confirmed.");}
    finally {setBusy(false);}
  }
  const serverReady = connection ? (connection.connectionReady ?? connection.ready) : false;
  const serverMissing = connection ? (connection.connectionMissing ?? connection.missing) : [];
  const weddingMissing = connection?.weddingMissing ?? [];
  const needsCoupleNames = Boolean(connection?.weddingTemplate && wedding.eventType === "Wedding" && (!wedding.setup.groomName.trim() || !wedding.setup.brideName.trim() || weddingMissing.includes("groom and bride names in event details")));
  const needsWeddingEventType = Boolean(connection?.weddingTemplate && (wedding.eventType !== "Wedding" || weddingMissing.includes("a wedding event for the configured template")));
  const field = "w-full rounded-xl border border-stone-300 bg-white p-3 mt-1";
  return <section className="rounded-2xl border border-emerald-200 bg-white p-6 space-y-4">
    <h2 className="font-serif text-xl font-bold">Send through Memorica WhatsApp</h2>
    <p className="text-sm text-stone-600">Send a personal invitation directly from Memorica’s business number. The message links to your selected event or sub-event card.</p>
    {!connection ? <p className="text-sm">Checking WhatsApp connection…</p> : !serverReady ? <div className="rounded-xl bg-amber-50 p-4 text-sm"><strong>Connection setup needed</strong><p className="mt-1">Still needed: {serverMissing.join(", ")}. Sending will be available after these settings are complete.</p></div> : <p className="text-sm text-emerald-700">WhatsApp is configured for this account.</p>}
    {connection && needsWeddingEventType && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm"><strong>Wedding event required</strong><p className="mt-1">The configured WhatsApp template is only for Wedding events. Use the regular <strong>Open WhatsApp</strong> button below for other event types.</p></div>}
    {connection && needsCoupleNames && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm space-y-3">
      <div><strong>Groom and bride names needed</strong><p className="mt-1 text-stone-700">The active WhatsApp wedding template requires separate groom and bride names (existing couple names “{wedding.coupleNames}” are not automatically split). Save both names below to enable sending.</p></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-medium">Groom’s name *<input value={groomName} maxLength={160} disabled={busy||savingNames} onChange={e=>setGroomName(e.target.value)} placeholder="e.g. Arjun" className={field}/></label>
        <label className="text-sm font-medium">Bride’s name *<input value={brideName} maxLength={160} disabled={busy||savingNames} onChange={e=>setBrideName(e.target.value)} placeholder="e.g. Meera" className={field}/></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy||savingNames||!groomName.trim()||!brideName.trim()} onClick={saveCoupleNames} className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{savingNames?"Saving…":"Save groom & bride names"}</button>
        {onOpenSetup && <button type="button" disabled={busy||savingNames} onClick={onOpenSetup} className="text-xs font-semibold underline text-amber-900">Open Complete Event Details</button>}
      </div>
    </div>}
    {!!connection?.testRecipients?.length && <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 space-y-3">
      <h3 className="font-semibold">Local WhatsApp test</h3>
      <p className="text-sm">Send Meta’s “Hello World” sample directly to a verified test number. This checks the connection; it does not send your event invitation or card.</p>
      <label className="block text-sm">Test recipient<select className={field} value={testPhone} disabled={busy} onChange={e=>setTestPhone(e.target.value)}><option value="">Choose test number</option>{connection.testRecipients.map(phone=><option key={phone} value={phone}>{phone}</option>)}</select></label>
      <button type="button" disabled={!testPhone||busy} onClick={sendSample} className="rounded-xl bg-emerald-700 px-4 py-2 text-white disabled:opacity-40">{busy?"Sending…":"Send WhatsApp sample"}</button>
    </div>}
    <button type="button" disabled={busy} className="text-sm underline text-emerald-800" onClick={()=>refresh().catch(e=>{setNotice(e.message);setError(true);})}>Refresh connection and send status</button>
    <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium">Guest<select className={field} disabled={busy} value={guestId} onChange={e=>{setGuestId(e.target.value);setConsent(false);setReview(false);const assigned=guests.find(g=>g.id===e.target.value)?.invitationKey;setInvitationKey(choices.some(o=>o.key===assigned)?assigned!:"");}}><option value="">Choose a guest</option>{guests.map(g=><option key={g.id} value={g.id} disabled={!g.phone}>{g.name}{g.phone?` · ${g.phone}`:" · phone number needed"}</option>)}</select></label>
    <label className="text-sm font-medium">Invitation card<select className={field} disabled={busy} value={invitationKey} onChange={e=>{setInvitationKey(e.target.value);setReview(false);}}><option value="">Choose an event</option>{choices.map(o=><option key={o.key} value={o.key}>{o.title}</option>)}</select></label></div>
    {guest && !guest.phone && <p role="alert" className="text-sm text-amber-800">Add a phone number with its country code for this guest before sending a WhatsApp invitation.</p>}
    {!guests.length && <p className="text-sm text-stone-600">Add guests with phone numbers in Invite Contacts first.</p>}
    {prior && <p className="rounded-xl bg-stone-50 p-3 text-sm">Previous send: <strong>{prior.status==="accepted"?"Accepted by WhatsApp; delivery not confirmed":prior.status}</strong>{prior.error&&` — ${prior.error}`}</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>This guest agreed to receive event invitations from Memorica on WhatsApp.</span></label>
    <button type="button" disabled={!connection?.ready||!guest?.phone||!choice||!consent||busy||blocked} className="rounded-xl px-4 py-3 bg-emerald-700 text-white font-semibold disabled:opacity-40" onClick={()=>setReview(true)}>Review WhatsApp invitation</button>
    {review && guest && choice && <div role="dialog" aria-modal="true" aria-label="Confirm WhatsApp invitation" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto space-y-4">
      <h3 className="font-semibold text-lg">Send to {guest.name}?</h3><p className="text-sm">Recipient: {guest.phone}</p>
      {connection?.weddingTemplate ? <div className="rounded-xl bg-emerald-50 p-4 text-sm whitespace-pre-line">{`🌸 Two hearts. One beautiful beginning. 🌸

With joyful hearts, we invite you to celebrate the wedding of

🤵 ${wedding.setup.groomName} & 👰 ${wedding.setup.brideName}

Your presence, love and blessings would mean so much to us as we begin this new chapter. 💕

💌 Click the Memorica link below to explore the invitation, wedding celebrations, dates and venue details, and confirm your attendance:
[personal invitation link]

✨ Come make memories with us!`}</div> : <div className="rounded-xl bg-emerald-50 p-4 text-sm">Hi {guest.name}, you’re invited to {choice.title}. View your invitation and RSVP: <span className="underline">[personal invitation link]</span></div>}
      <MediaPreview asset={choice.card}/><p className="text-xs text-stone-500">The card is available through the invitation link. Meta’s approved template controls the final message wording.</p>
      <div className="flex gap-3"><button type="button" disabled={busy} onClick={()=>setReview(false)} className="border rounded-xl px-4 py-2">Cancel</button><button type="button" disabled={busy||blocked||!consent||!connection?.ready||!guest.phone} onClick={send} className="rounded-xl px-4 py-2 bg-emerald-700 text-white disabled:opacity-40">{busy?"Sending…":"Send WhatsApp invitation"}</button></div>
      {notice&&<p role={error?"alert":"status"} className="text-sm">{notice}</p>}
    </div></div>}
    {notice&&<p role={error?"alert":"status"} className={`text-sm ${error?"text-red-700":"text-emerald-800"}`}>{notice}</p>}
  </section>;
}
