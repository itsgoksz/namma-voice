import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Starfield from "@/components/Starfield";
import LoginOverlay from "@/components/LoginOverlay";
import PWACameraSetup from "@/components/PWACameraSetup";
import OfflineSyncWorker from "@/components/OfflineSyncWorker";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Namma Hood",
  description: "Community cleanup civic action platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} h-[100dvh] w-full overflow-hidden text-white relative bg-black`}>
        <PWACameraSetup />
        <OfflineSyncWorker />
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
