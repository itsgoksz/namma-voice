import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Starfield from "@/components/Starfield";
import LoginOverlay from "@/components/LoginOverlay";
import PWACameraSetup from "@/components/PWACameraSetup";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Namma Voice",
  description: "Gamified, location-based civic action app for Bangalore",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} h-[100dvh] w-full overflow-hidden text-white relative bg-[#0d1b0a]`}>
        <PWACameraSetup />
        <LoginOverlay />
        <Starfield />
        <main className="max-w-md mx-auto h-full w-full relative z-10 pt-6">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
