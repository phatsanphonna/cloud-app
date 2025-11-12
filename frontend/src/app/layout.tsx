import type { Metadata } from "next";
import { Mali } from "next/font/google";
import './globals.css';
import { AuroraBackground } from "@/components/ui/shadcn-io/aurora-background";
import Navbar from "@/components/next/Navbar";
import { UserProvider } from "@/lib/user";
import { Toaster } from "@/components/ui/sonner"

const mali = Mali({
  subsets: ["latin", 'thai'],
  weight: ["200", "300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stake It All",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${mali.className} antialiased`}
      >
        <UserProvider>
          <AuroraBackground className="min-h-screen !h-auto items-stretch justify-start">
            <div className="relative z-10 flex min-h-screen w-full flex-col">
              <header className="sticky top-0 z-20 w-full border-b border-white/30 bg-white/70 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-900/70">
                <div className="mx-auto w-full max-w-6xl">
                  <Navbar />
                </div>
              </header>
              <main className="flex-1 w-full px-4 py-6 pb-12 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-6xl">
                  {children}
                </div>
              </main>
            </div>
          </AuroraBackground>
        </UserProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
