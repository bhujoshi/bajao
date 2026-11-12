import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Wedding Memories — Digital Wedding Invitations & Live Updates",
  description:
    "Create your wedding event, manage your guest list, share invitations, collect RSVPs, and publish live updates for your verified guests.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#fdfbf7] text-stone-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-stone-200/80 bg-white py-6 text-center text-xs text-stone-500">
            <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>
                © {new Date().getFullYear()} Wedding Memories. All rights
                reserved.
              </span>
              <span className="text-stone-400">
                Digital Wedding Invitations & Live Guest Updates
              </span>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
