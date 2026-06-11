import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import ThemeToggle from "@/components/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BMKG Kapuas Hulu",
  description: "Portal prakiraan cuaca, peringatan dini, dan pemantauan Kapuas Hulu berbasis Next.js",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const ls = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
                  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const theme = ls || (prefersDark ? 'dark' : 'light');
                  const root = document.documentElement;
                  if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
                } catch {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} text-foreground antialiased`}>
        <div className="app-root min-h-screen flex bg-app relative">
          <SidebarNav />
          <div className="flex flex-1 flex-col">
            {/* Mobile top bar fixed */}
            <header className="xl:hidden border-b border-border/40 bg-sidebar/80 backdrop-blur-md px-4 py-3 fixed top-0 left-0 right-0 z-40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MobileNav />
                  <div className="flex items-center gap-2">
                    <Image src="/bmkg.png" alt="BMKG" width={28} height={28} className="w-7 h-7 object-contain" />
                    <Link href="/" className="font-semibold text-sm leading-tight">
                      BMKG <br/><span className="text-muted-foreground font-normal">Kapuas Hulu</span>
                    </Link>
                  </div>
                </div>
                <ThemeToggle />
              </div>
            </header>
            {/* Spacer for fixed mobile header */}
            <div className="h-16 xl:hidden" />
            
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative z-[1]">
              {children}
            </main>
            <footer className="border-t border-[--sidebar-border] px-6 lg:px-10 py-4 text-xs text-muted-foreground">
              (c) {new Date().getFullYear()} BMKG Pangsuma Kapuas Hulu | by Sinangga
            </footer>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
