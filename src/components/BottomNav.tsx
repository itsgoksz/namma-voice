"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Compass, Plus, Trophy, User, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "MAP", href: "/", icon: Home },
  { name: "FEED", href: "/feed", icon: Compass },
  { name: "ADD", href: "/report", icon: Plus, special: true },
  { name: "RANK", href: "/leaderboard", icon: Trophy },
  { name: "ME", href: "/profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 right-4 z-[9999] bg-[#05110b]/[0.87] backdrop-blur-2xl border border-[#10b981]/20 rounded-[2rem] max-w-md mx-auto h-20 px-2 shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around h-full relative">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.special) {
            return (
              <Link key={item.name} href={item.href} className="relative -top-6 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-[#f14f4f] rounded-full p-4 flex items-center justify-center shadow-[0_0_20px_rgba(241,79,79,0.5)] border-4 border-[#000000]"
                >
                  <Icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className="relative flex flex-col items-center justify-center w-16 h-full space-y-1"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "flex flex-col items-center",
                  isActive ? "text-zinc-400" : "text-[#71717a]"
                )}
              >
                <Icon
                  className={cn("w-5 h-5", isActive ? "stroke-[#10b981]" : "")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="text-xs font-black mt-1.5 tracking-wider">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-2 w-1.5 h-1.5 bg-white rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
