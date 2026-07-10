"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { MapPin, Clock, Heart } from "lucide-react";

interface FeedItem {
  id: number;
  username: string;
  lat: number;
  lng: number;
  image_base64: string | null;
  timestamp: string;
  supports: number;
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await apiFetch('/feed');
        if (res.ok) {
          const data = await res.json();
          setFeed(data);
        }
      } catch (e) {
        console.error("Failed to fetch feed", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSupport = async (id: number) => {
    // Check if already supported locally
    const supportedStr = localStorage.getItem('namma_supported_posts') || '[]';
    const supported = JSON.parse(supportedStr);
    if (supported.includes(id)) return;
    
    // Optimistic update
    setFeed(prev => prev.map(post => 
      post.id === id ? { ...post, supports: post.supports + 1 } : post
    ));
    
    // Mark as supported
    supported.push(id);
    localStorage.setItem('namma_supported_posts', JSON.stringify(supported));

    try {
      await apiFetch(`/reports/${id}/support`, { method: "POST" });
    } catch (e) {
      console.error("Failed to support post", e);
    }
  };

  const timeAgo = (dateStr: string) => {
    // Append 'Z' to SQLite datetime string so JS treats it as UTC, not local time
    const dateStrWithZ = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
    const seconds = Math.floor((new Date().getTime() - new Date(dateStrWithZ).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-4 space-y-6 h-full flex flex-col pt-8 pb-32 max-w-md mx-auto relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1 mb-4"
      >
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Community</h1>
        <p className="text-text-secondary text-sm font-medium">Live civic action feed.</p>
      </motion.div>

      {loading && feed.length === 0 ? (
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feed.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center border border-white/5 bg-[rgba(20,20,20,0.85)]">
          <p className="text-text-secondary">No one has posted yet. Be the first to clean up your neighborhood!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feed.map((post, i) => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl overflow-hidden border border-white/5 bg-[rgba(20,20,20,0.85)] flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center bg-white/5">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#ff4d6d]/20 rounded-full flex items-center justify-center text-xl border border-[#ff4d6d]/30">
                    👤
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{post.username}</p>
                    <div className="flex items-center space-x-1 text-[10px] text-text-secondary">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(post.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-[#ff4d6d]/10 px-3 py-1 rounded-full border border-[#ff4d6d]/20">
                  <span className="text-[#ff4d6d] text-xs font-black">+10 XP</span>
                </div>
              </div>

              {/* Photo */}
              <div className="w-full aspect-square bg-black relative border-y border-white/5">
                {post.image_base64 ? (
                  <img src={post.image_base64} alt="Report" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    No Photo
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-1 border border-white/10">
                  <MapPin className="text-[#ff4d6d] w-3 h-3" />
                  <span className="text-xs text-white font-semibold shadow-sm">Mini Forest Road</span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 flex justify-between items-center">
                <p className="text-sm text-text-secondary">
                  <span className="text-white font-bold mr-2">{post.username}</span>
                  Spotted garbage and took action!
                </p>
                <button 
                  onClick={() => handleSupport(post.id)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors group flex items-center space-x-1.5"
                >
                  <Heart className="w-5 h-5 text-text-secondary group-hover:text-[#ff4d6d] transition-colors" />
                  <span className="text-sm font-semibold text-text-secondary group-hover:text-white transition-colors">
                    {post.supports || 0}
                  </span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
