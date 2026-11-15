"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Heart, LogIn, LogOut, Menu, UserCheck, X } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-700 text-white shadow-sm group-hover:bg-rose-800 transition">
              <Heart className="h-4 w-4 fill-current" />
            </div>
            <span className="font-serif text-lg font-bold tracking-tight text-stone-900">
              Memorica
            </span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link
                href="/"
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  pathname === "/"
                    ? "bg-rose-50 text-rose-800"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                My Events & Invitations
              </Link>
            </nav>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-800">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="Your profile" className="h-full w-full rounded-full object-cover" /> : user.name.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1 text-xs font-semibold text-stone-900">
                    {user.name}
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {user.email || user.phone}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                title="Sign out"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In / Register
            </button>
          )}
        </div>

        {/* Mobile Nav Controls */}
        <div className="flex items-center gap-2 md:hidden">
          {user ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800"
            >
              {user.avatarUrl ? <img src={user.avatarUrl} alt="Your profile" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-2 w-2 rounded-full bg-emerald-500" />}
              {user.name.split(" ")[0]}
              {mobileMenuOpen ? (
                <X className="h-4 w-4 ml-1" />
              ) : (
                <Menu className="h-4 w-4 ml-1" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && user && (
        <div className="border-t border-stone-200 bg-white px-4 py-3 md:hidden space-y-2">
          <div className="px-2 py-1 text-xs text-stone-500">
            Signed in as{" "}
            <strong className="text-stone-800">
              {user.email || user.phone}
            </strong>
          </div>
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            My Events & Invitations
          </Link>
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                signOut();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
