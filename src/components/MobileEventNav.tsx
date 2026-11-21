"use client";

import { useRef } from "react";
import Link from "next/link";
import { Bell, ChartNoAxesCombined, ClipboardList, Ellipsis, House, Settings2, Share2, Users, X } from "lucide-react";

type Tab = "setup" | "guests" | "share" | "updates" | "overview" | "analytics";
export default function MobileEventNav({ active, ready, onSelect }: { active: Tab; ready: boolean; onSelect: (tab: Tab) => void }) {
  const menu = useRef<HTMLDialogElement>(null);
  function select(tab: Tab) {
    menu.current?.close();
    onSelect(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <>
    <nav aria-label="Event navigation" className="mobile-event-nav sm:hidden">
      {([
        { id: "setup", label: "Details", icon: ClipboardList },
        { id: "guests", label: "Guests", icon: Users },
        { id: "share", label: "Invitations", icon: Share2 },
        { id: "updates", label: "Updates", icon: Bell },
      ] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} disabled={!ready && (id === "guests" || id === "updates")} title={!ready && (id === "guests" || id === "updates") ? "Complete event details first" : label} onClick={() => select(id)} className={active === id ? "is-active" : ""}><Icon size={20}/><span>{label}</span></button>)}
      <button type="button" aria-haspopup="dialog" onClick={() => menu.current?.showModal()} className={active === "overview" || active === "analytics" ? "is-active" : ""}><Ellipsis size={20}/><span>More</span></button>
    </nav>
    <dialog ref={menu} aria-label="More event options" className="event-more-sheet sm:hidden">
      <div className="flex items-center justify-between border-b border-rose-100 pb-4"><h2 className="font-serif text-2xl">Your event</h2><button type="button" aria-label="Close menu" onClick={() => menu.current?.close()} className="rounded-full bg-rose-50 p-3"><X size={18}/></button></div>
      <button type="button" onClick={() => select("overview")} className="more-option"><Settings2 size={20}/>Event settings</button>
      <button type="button" onClick={() => select("analytics")} className="more-option"><ChartNoAxesCombined size={20}/>Insights & activity</button>
      <Link href="/" className="more-option"><House size={20}/>All my celebrations</Link>
    </dialog>
  </>;
}
