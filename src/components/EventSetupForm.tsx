"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { WeddingDTO, encodeUserHintHeader } from "@/lib/types";
import { EventMedia, SubEvent, missingEventDetails } from "@/lib/event-setup";
import DateInput from "./DateInput";
export function MediaPreview({ asset }: { asset: EventMedia }) {
  const url = `/api/media/${asset.id}`;
  if (asset.mime.startsWith("image/")) return <img src={url} alt={asset.name} className="max-h-80 w-full rounded-xl object-contain bg-stone-50" />;
  if (asset.mime.startsWith("video/")) return <video src={url} controls preload="metadata" className="max-h-80 w-full rounded-xl" />;
  return <a href={url} target="_blank" rel="noreferrer" className="block rounded-xl border p-4 text-rose-700 underline">View PDF invitation: {asset.name}</a>;
}
export default function EventSetupForm({ wedding, onSaved, onInvite, onNext, mode = "details" }: {
  wedding: WeddingDTO; onSaved: (event: WeddingDTO) => void; onInvite: () => void; onNext?: () => void; mode?: "details" | "invitations";
}) {
  const { user } = useAuth();
  const [setup, setSetup] = useState(wedding.setup);
  const [message, setMessage] = useState(wedding.description || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const prevWeddingId = useRef(wedding.id);
  const prevDescription = useRef(wedding.description || "");
  useEffect(() => {
    const nextDescription = wedding.description || "";
    if (prevWeddingId.current !== wedding.id) {
      prevWeddingId.current = wedding.id;
      prevDescription.current = nextDescription;
      setSetup(wedding.setup);
      setMessage(nextDescription);
      return;
    }
    if (prevDescription.current !== nextDescription) {
      prevDescription.current = nextDescription;
      setMessage(nextDescription);
    }
    setSetup(prev => mode === "details" ? wedding.setup : { ...prev, groomName: wedding.setup.groomName, brideName: wedding.setup.brideName });
  }, [wedding, mode]);
  const missing = missingEventDetails({ ...wedding, setup, description: message });
  const isWedding = wedding.eventType === "Wedding";
  const coupleDone = Boolean(setup.groomName.trim() && setup.brideName.trim());
  const breakdownDone = setup.subEvents.length > 0 && !missing.some(item => item.startsWith("Sub-event"));
  const invitationDone = !missing.some(item => /invitation/i.test(item));
  const sectionClass = (done: boolean) => `rounded-2xl border p-6 space-y-5 ${done ? "border-emerald-300 bg-emerald-50/50" : "bg-white border-stone-200"}`;
  const doneMark = (done: boolean, optional = false) => <span className={`float-right ml-3 text-xs font-semibold ${done ? "text-emerald-700" : "text-stone-500"}`}>{done ? "✓ Done" : optional ? "Optional" : "Required"}</span>;
  const inputClass = "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm focus:border-rose-600 focus:outline-none";
  function changeSub(id: string, update: Partial<SubEvent>) { setSetup(prev=>({...prev,subEvents:prev.subEvents.map(sub=>sub.id===id?{...sub,...update}:sub)})); }
  async function upload(files: FileList | null, target: "overall" | "photos" | string) {
    if (!files?.length) return;
    const selected = Array.from(files);
    setUploading(true); setNotice(""); setError(false);
    try {
      if (target === "photos" && setup.photos.length + selected.length > 8) throw new Error("You can add up to 8 couple photos.");
      const assets: EventMedia[] = [];
      for (const file of selected) {
        if (target === "photos" && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose JPG, PNG, WebP or GIF couple photos.");
        if (file.size > 20*1024*1024) throw new Error("Each file must be under 20 MB.");
        const form = new FormData(); form.append("file", file);
        const response = await fetch(`/api/weddings/${wedding.id}/media`, {method:"POST", credentials:"same-origin", headers:{...encodeUserHintHeader(user)}, body:form});
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        assets.push(data.asset);
      }
      setSetup(prev => target === "overall" ? {...prev,card:assets[0]} : target === "photos" ? {...prev,photos:[...prev.photos,...assets]} : {...prev,subEvents:prev.subEvents.map(sub=>sub.id===target?{...sub,card:assets[0]}:sub)});
      setNotice("Upload ready. Save your changes to update the invitation.");
    } catch (err) { setError(true); setNotice(err instanceof Error ? err.message : "Upload failed."); }
    finally { setUploading(false); }
  }
  async function save(e: React.SyntheticEvent, advance = true) {
    e.preventDefault();
    if (advance && missing.length) return; setBusy(true); setNotice(""); setError(false);
    try {
      const payloadSetup = mode === "invitations" ? { ...setup, groomName: wedding.setup.groomName, brideName: wedding.setup.brideName } : setup;
      const response = await fetch(`/api/weddings/${wedding.id}`,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json",...encodeUserHintHeader(user)},body:JSON.stringify({setup:payloadSetup,description:message})});

      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      onSaved(data.wedding);
      if (advance && !missingEventDetails(data.wedding).length) { onInvite(); return; }
      setNotice(missingEventDetails(data.wedding).length ? `Draft saved. Still needed: ${missingEventDetails(data.wedding).join("; ")}.` : "Event details saved.");
    } catch(err) { setError(true); setNotice(err instanceof Error ? err.message : "Could not save details."); }
    finally {setBusy(false);}
  }
  function cardUpload(title: string, target: string, card: EventMedia | null, required: boolean) {
    return <div className="rounded-2xl border border-stone-200 p-5 space-y-3" key={target}>
      <label className="block text-sm font-semibold">{title}{required ? " *" : " (optional)"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" disabled={uploading || busy} onChange={e=>{void upload(e.target.files,target);e.target.value="";}} className={inputClass}/></label>
      {card && <><MediaPreview asset={card}/><button type="button" onClick={()=>target==="overall"?setSetup({...setup,card:null}):changeSub(target,{card:null})} className="text-xs text-rose-700 underline">Remove card</button></>}
    </div>;
  }
  return <form onSubmit={e=>{void save(e);}} className="space-y-6">
    <section className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 space-y-3">
      <span className="text-xs font-bold uppercase tracking-widest text-rose-700">{mode === "details" ? "Step 1 · Event details" : "Step 2 · Invitation Card & Share"}</span>
      <h2 className="font-serif text-2xl font-bold">{mode === "details" ? "Complete your event details" : "Customize Your Invitation Message & Cards"}</h2>
      <p className="text-sm text-stone-600">{mode === "details" ? "Complete the couple’s names, add your celebrations, and customize your invitation below." : "Upload one universal invitation or individual cards for your sub-events. Save your changes before inviting contacts."}</p>
      {missing.length > 0 && <ul className="flex flex-wrap gap-2">{missing.map(item=><li key={item} className="rounded-full bg-white border border-rose-200 px-3 py-1 text-xs text-rose-800">{item}</li>)}</ul>}
      <p className="text-xs text-stone-500">Fields marked * are needed before inviting contacts. Save a draft at any time.</p>
    </section>
    {mode === "details" && <>
      {isWedding && <details open className={sectionClass(coupleDone)}>
        <summary className="cursor-pointer font-serif text-xl font-bold">1. The couple and their family{doneMark(coupleDone)}</summary>
        <div className="grid sm:grid-cols-2 gap-4">{([['groomName','Groom’s name'],['brideName','Bride’s name']] as const).map(([key,label])=><label key={key} className="text-sm font-medium">{label} *<input value={setup[key]} maxLength={160} onChange={e=>setSetup({...setup,[key]:e.target.value})} className={inputClass}/></label>)}</div>
        <p className="text-sm text-stone-600">Only the groom’s and bride’s names are required in this section. Family names and hashtags are optional.</p>
        <div className="grid sm:grid-cols-2 gap-4">{([['partnerOneMother','Groom’s mother'],['partnerOneFather','Groom’s father'],['partnerTwoMother','Bride’s mother'],['partnerTwoFather','Bride’s father'],['coupleHashtag','Wedding hashtag for the couple'],['otherHashtags','Other wedding hashtags']] as const).map(([key,label])=><label key={key} className="text-sm font-medium">{label} (optional)<input value={setup[key]} maxLength={500} onChange={e=>setSetup({...setup,[key]:e.target.value})} placeholder={key.includes('Hashtag')?'#TogetherForever':'Full name'} className={inputClass}/></label>)}</div>
      </details>}
      <details className={sectionClass(breakdownDone)}>
        <summary className="cursor-pointer font-serif text-xl font-bold">2. Break down your event{doneMark(breakdownDone, true)}</summary>
        <p className="text-sm text-stone-600">This section is optional. Add celebrations such as Mehndi, Haldi and Wedding if you need them. Dates must fall within your overall event range. Times are local to your event venue.</p>

        {!setup.subEvents.length && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">No sub-events yet. Keep a single event or add your schedule below.</p>}
        {setup.subEvents.map((sub,index)=><div key={sub.id} className="rounded-2xl border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between"><h4 className="font-semibold">Event {index+1}</h4><button type="button" onClick={()=>setSetup({...setup,subEvents:setup.subEvents.filter(item=>item.id!==sub.id)})} className="text-xs text-rose-700 underline">Remove sub-event</button></div>
          <label className="block text-sm">Event name *<input value={sub.name} maxLength={160} onChange={e=>changeSub(sub.id,{name:e.target.value})} placeholder="e.g. Mehndi" className={inputClass}/></label>
          <div className="grid sm:grid-cols-2 gap-3"><label className="block text-sm">From date & time *<DateInput type="datetime-local" min={`${wedding.date.slice(0,10)}T00:00`} max={`${(wedding.endDate||wedding.date).slice(0,10)}T23:59`} value={sub.from} onChange={e=>changeSub(sub.id,{from:e.target.value,...(sub.to && sub.to<e.target.value?{to:e.target.value}:{})})} className={inputClass}/></label>
          <label className="block text-sm">To date & time *<DateInput type="datetime-local" min={sub.from || `${wedding.date.slice(0,10)}T00:00`} max={`${(wedding.endDate||wedding.date).slice(0,10)}T23:59`} value={sub.to} onChange={e=>changeSub(sub.id,{to:e.target.value})} className={inputClass}/></label></div>
          <label className="block text-sm">Remarks<textarea rows={2} maxLength={2000} value={sub.remarks} onChange={e=>changeSub(sub.id,{remarks:e.target.value})} placeholder="Venue, dress code or anything guests should know" className={inputClass}/></label>
        </div>)}
        <button type="button" disabled={setup.subEvents.length>=50} onClick={()=>setSetup({...setup,subEvents:[...setup.subEvents,{id:crypto.randomUUID(),name:"",from:"",to:"",remarks:"",card:null}]})} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700">+ Add sub-event</button>
      </details>
    </>}
    <details open={mode === "invitations"} className={sectionClass(invitationDone)}>
      <summary className="cursor-pointer font-serif text-xl font-bold">3. Invitation details{doneMark(invitationDone)}</summary>
      <label className="block text-sm font-medium">Invitation message *<textarea rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Together with our families, we warmly invite you…" className={inputClass}/></label>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold mb-2">How would you like to use invitation cards?</legend>
        <label className="flex gap-3 rounded-xl border p-4 text-sm"><input type="radio" name="invitationMode" checked={setup.invitationMode==='universal'} onChange={()=>setSetup({...setup,invitationMode:'universal'})}/><span><strong>Universal invitation</strong><br/>Use one card for the overall event and all sub-events.</span></label>
        <label className="flex gap-3 rounded-xl border p-4 text-sm"><input type="radio" name="invitationMode" checked={setup.invitationMode==='specific'} onChange={()=>setSetup({...setup,invitationMode:'specific'})}/><span><strong>Specific invitations</strong><br/>Upload a different card for each sub-event, plus an optional overall card.</span></label>
      </fieldset>
      <p className="text-xs text-stone-500">Photo, animated GIF, MP4 / WebM video or PDF · maximum 20 MB per file. Replacing a card updates its saved invitation link.</p>
      {cardUpload(`${wedding.eventTitle} — ${setup.invitationMode==='universal'?'universal card':'overall event card'}`,"overall",setup.card,setup.invitationMode==='universal'||!setup.subEvents.length)}
      {setup.invitationMode==='specific' && setup.subEvents.map((sub,index)=>cardUpload(sub.name||`Sub-event ${index+1}`,sub.id,sub.card,true))}
      {setup.invitationMode==='specific' && !setup.subEvents.length && <p className="text-sm text-stone-600">Add sub-events in the event breakdown section to upload specific invitations. For now, upload your overall event card.</p>}
    </details>
    <div className="rounded-2xl border bg-white p-5 flex flex-wrap items-center gap-4">
      <button type="button" disabled={busy||uploading} onClick={e=>{void save(e,false);}} className="rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold disabled:opacity-50">Save draft</button>
      <button type="submit" disabled={busy||uploading||missing.length > 0} className="rounded-xl bg-rose-700 text-white px-5 py-3 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">{uploading?'Uploading…':busy?'Saving…':'Save details & invite contacts'}</button>
      <p role={error?'alert':'status'} className={`text-sm ${error?'text-red-700':'text-stone-600'}`}>{notice}</p>
    </div>
  </form>;
}
