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
  title: "Bet Everything",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${mali.className} antialiased`}
      >
        <UserProvider>
          <AuroraBackground>
            <div className="grid grid-rows-[auto_1fr] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 w-full relative z-10">
              <Navbar />
              {children}
            </div>
          </AuroraBackground>
        </UserProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
