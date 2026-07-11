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
const pendingRequests: Record<string, Promise<string> | undefined> = {};

const geocodeWithQueue = async (lat: number, lng: number): Promise<string> => {
  const cacheKey = `namma_loc_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  
  if (pendingRequests[cacheKey]) {
    return pendingRequests[cacheKey];
  }

  const promise = new Promise<string>(async (resolve) => {
    try {
      // Small random delay to stagger simultaneous renders and avoid rate limits
      await new Promise(r => setTimeout(r, 500 + Math.random() * 2000));
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
      const data = await res.json();
      const locName = data.address?.road || data.address?.neighbourhood || data.address?.suburb || "Unknown Location";
      localStorage.setItem(cacheKey, locName);
      resolve(locName);
    } catch (e) {
      resolve("Unknown Location");
    }
  });

  pendingRequests[cacheKey] = promise;
  const result = await promise;
  delete pendingRequests[cacheKey];
  return result;
};

// LocationTag Component for dynamic reverse geocoding
const LocationTag = ({ lat, lng }: { lat: number, lng: number }) => {
  const [address, setAddress] = useState("Loading...");

  useEffect(() => {
    let mounted = true;
    const fetchAddress = async () => {
      const addr = await geocodeWithQueue(lat, lng);
      if (mounted) setAddress(addr);
    };
    fetchAddress();
    return () => { mounted = false; };
  }, [lat, lng]);

  return <span className="text-xs text-white font-semibold shadow-sm">{address}</span>;
};

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
    <div className="p-4 space-y-6 h-full overflow-y-auto flex flex-col pt-8 pb-32 max-w-md mx-auto relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1 mb-4"
      >
        <h1 className="text-4xl font-bold text-white tracking-tight">Community</h1>
        <p className="text-[#455d49] text-sm font-medium">Live civic action feed.</p>
      </motion.div>

      {loading && feed.length === 0 ? (
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-[#455d49] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feed.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center border border-white/10 bg-[rgba(11,46,30,0.6)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <p className="text-[#455d49]">No one has posted yet. Be the first to clean up your neighborhood!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feed.map((post, i) => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl overflow-hidden border border-white/10 bg-[rgba(11,46,30,0.6)] backdrop-blur-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center bg-[#455d49]/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#455d49]/20 rounded-full flex items-center justify-center text-xl border border-[#455d49]/30">
                    👤
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{post.username}</p>
                    <div className="flex items-center space-x-1 text-[10px] text-[#455d49]">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(post.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-[#455d49]/10 px-3 py-1 rounded-full border border-[#455d49]/20">
                  <span className="text-[#455d49] text-xs font-black">+10 🌏 Points</span>
                </div>
              </div>

              {/* Photo */}
              <div className="w-full aspect-square bg-[#0d1b0a] relative border-y border-[#455d49]">
                {post.image_base64 ? (
                  <img src={post.image_base64} alt="Report" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    No Photo
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-[#0d1b0a]/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-1 border border-[#455d49]">
                  <MapPin className="text-[#455d49] w-3 h-3" />
                  <LocationTag lat={post.lat} lng={post.lng} />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 flex justify-between items-center">
                <p className="text-sm text-[#455d49]">
                  <span className="text-white font-bold mr-2">{post.username}</span>
                  Spotted garbage and took action!
                </p>
                <button 
                  onClick={() => handleSupport(post.id)}
                  className="px-3 py-1.5 bg-[#455d49]/30 hover:bg-[#455d49]/30 rounded-full transition-colors group flex items-center space-x-1.5"
                >
                  <Heart className="w-5 h-5 text-[#455d49] group-hover:text-[#455d49] transition-colors" />
                  <span className="text-sm font-semibold text-[#455d49] group-hover:text-white transition-colors">
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
