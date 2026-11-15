"use client";
import { useEffect, useState } from "react";
export default function EventCreatedCelebration({eventId}: {eventId:string}) {
  const [show, setShow] = useState(false);
  useEffect(()=>{
    const key = `memorica-created-${eventId}`;
    if (sessionStorage.getItem(key)) { setShow(true); sessionStorage.removeItem(key); }
  },[eventId]);
  if (!show) return null;
  return <section role="status" className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">{Array.from({length:130},(_,i)=><span key={i} className="memorica-confetti" style={{left:`${(i*37)%100}%`,backgroundColor:["#ff007f","#ffde00","#00e676","#00b0ff","#a100ff","#ff6d00"][i%6],animationDelay:`${(i%8)*.12}s`, transform:`rotate(${i*23}deg)`}}/>)}</div>
    <div className="relative flex items-start justify-between gap-4"><div className="space-y-2"><p className="text-xs uppercase tracking-widest font-bold text-emerald-700">A new memory begins</p><h2 className="text-2xl font-serif font-bold text-emerald-950">Your event has been created!</h2><p className="text-sm text-emerald-900">Complete the event details, then start inviting your contacts.</p></div><button type="button" aria-label="Dismiss event creation confirmation" onClick={()=>setShow(false)} className="rounded-lg px-2 py-1 text-emerald-800">✕</button></div>
  </section>;
}
