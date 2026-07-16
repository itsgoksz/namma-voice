"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, ShoppingBag, Flame } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/api";
import { getUserStreak } from "@/lib/streak";

export default function NotificationInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    // Request Native Push Notification Permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setHasPermission(true);
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") setHasPermission(true);
        });
      }
    }

    const username = getCurrentUser();
    if (!username) return;

    // Fetch user streak
    getUserStreak(username).then(setStreak);

    // Fetch initial notifications
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    };

    fetchNotifs();

    // Subscribe to realtime changes for Push Notifications
    const channel = supabase.channel('custom-insert-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `username=eq.${username}` },
        (payload) => {
          const notif = payload.new;
          setNotifications(prev => [notif, ...prev]);
          setUnreadCount(c => c + 1);

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(notif.title, { body: notif.message });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleInbox = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    // Mark all as read when opening
    if (nextState && unreadCount > 0) {
      setUnreadCount(0);
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      if (unreadIds.length > 0) {
        const username = getCurrentUser();
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds).eq('username', username);
      }
    }
  };

  return (
    <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 z-[900] flex items-center space-x-3">

      {/* Streak Badge */}
      <Link href="/profile">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#10b981]/10 border border-[#10b981]/20 px-3 h-10 rounded-full flex items-center shadow-[0_0_15px_rgba(16,185,129,0.15)] backdrop-blur-md active:scale-95 transition-transform"
        >
          <Flame className="w-4 h-4 text-[#ff9f1c] mr-1.5 fill-current" />
          <span className="text-white font-bold text-sm">{streak}</span>
        </motion.div>
      </Link>

      {/* Shop Link */}
      <Link href="/shop" className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-[#d4af37]/30 flex items-center justify-center relative active:scale-95 transition-transform shadow-[0_0_15px_rgba(212,175,55,0.2)]">
        <ShoppingBag className="w-5 h-5 text-[#d4af37]" />
      </Link>

      {/* Notifications Toggle */}
      <button
        onClick={toggleInbox}
        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center relative active:scale-95 transition-transform"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-[#ff4d6d] border-2 border-black rounded-full animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[950] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-12 right-0 w-80 max-h-[60vh] bg-[#111] border border-white/20 rounded-2xl shadow-2xl z-[1000] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]">
                <h3 className="font-bold text-white">Notifications</h3>
                <button onClick={() => setIsOpen(false)}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>

              <div className="overflow-y-auto p-2 flex-1 space-y-2 flex flex-col">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 font-semibold text-sm">
                    No new notifications
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-xl border ${notif.read ? 'bg-white/5 border-transparent' : 'bg-[#10b981]/10 border-[#10b981]/20'} flex gap-3`}
                    >
                      <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${notif.read ? 'bg-zinc-600' : 'bg-[#10b981]'}`} />
                      <div>
                        <h4 className="text-white font-bold text-sm leading-tight mb-1">{notif.title}</h4>
                        <p className="text-zinc-400 text-xs">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
