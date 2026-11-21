import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "Memorica — Event Invitations & Live Updates",
  description:
    "Create your event, manage your guest list, share invitations, collect RSVPs, and publish live updates for your verified guests.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#ffffff] text-stone-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-stone-200/80 bg-white py-6 text-center text-xs text-stone-500">
            <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>
                © {new Date().getFullYear()} Memorica. All rights
                reserved.
              </span>
              <span className="text-stone-400">
                Event Invitations & Live Guest Updates
              </span>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
