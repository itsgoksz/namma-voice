"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { Camera as CameraIcon, MapPin, Clock, Megaphone, Info, AlertTriangle, Flame, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITIES = [
  { value: '1', label: "Light", color: "text-zinc-400" },
  { value: '2', label: "Moderate", color: "text-[#d4af37]" },
  { value: '3', label: "Severe", color: "text-[#ff9f1c]" },
  { value: '4', label: "Critical", color: "text-[#ff4d6d]" }
];

interface FeedItem {
  id: number;
  username: string;
  lat: number;
  lng: number;
  image_base64?: string;
  cleanup_image_base64?: string;
  timestamp: string;
  supports: number;
  severity?: string;
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
  const [isCleaningUp, setIsCleaningUp] = useState<number | null>(null);
  const [supportedPosts, setSupportedPosts] = useState<Set<number>>(new Set());

  useEffect(() => {
    const supportedStr = localStorage.getItem('namma_supported_posts') || '[]';
    try {
      setSupportedPosts(new Set(JSON.parse(supportedStr)));
    } catch (e) {}
    
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
    if (supportedPosts.has(id)) return;
    try {
      setSupportedPosts(prev => {
        const next = new Set(prev).add(id);
        localStorage.setItem('namma_supported_posts', JSON.stringify(Array.from(next)));
        return next;
      });
      await apiFetch(`/reports/${id}/support`, { method: "POST" });
      const res = await apiFetch('/feed');
      if (res.ok) {
         const data = await res.json();
         setFeed(data);
      }
    } catch (e) {
      console.error("Failed to support", e);
      setSupportedPosts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCleanup = async (id: number) => {
    try {
      try {
        const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
        if (permissions.camera === 'denied' || permissions.camera === 'prompt-with-rationale') {
          console.warn("Camera permission denied");
          return;
        }
      } catch (e) {}

      const image = await Camera.getPhoto({
        quality: 50,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      
      if (image.base64String) {
        setIsCleaningUp(id);
        const photoData = `data:image/jpeg;base64,${image.base64String}`;
        const username = getCurrentUser();
        
        await apiFetch(`/reports/${id}/cleanup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username,
            cleanup_image_base64: photoData
          })
        });
        
        // Refresh feed
        const res = await apiFetch('/feed');
        if (res.ok) {
           const data = await res.json();
           setFeed(data);
        }
      }
    } catch (e) {
      console.error("Failed to cleanup", e);
    } finally {
      setIsCleaningUp(null);
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
        <p className="text-zinc-400 text-sm font-medium">Live civic action feed.</p>
      </motion.div>

      {loading && feed.length === 0 ? (
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-[#10b981]/20 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feed.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <p className="text-zinc-400">No one has posted yet. Be the first to clean up your neighborhood!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feed.map((post, i) => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl overflow-hidden border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center bg-[#10b981]/5">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#10b981]/5 rounded-full flex items-center justify-center text-xl border border-[#10b981]/20">
                    👤
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{post.username}</p>
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-400">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(post.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <div className="bg-[#10b981]/5 px-3 py-1 rounded-full border border-[#10b981]/20">
                    <span className="text-[#d4af37] text-xs font-black">+10 Eco XP</span>
                  </div>
                  {post.severity && SEVERITIES.find(s => s.value == post.severity) && (
                    <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 flex items-center">
                      <span className={cn("text-xs font-bold", SEVERITIES.find(s => s.value == post.severity)?.color)}>
                        {SEVERITIES.find(s => s.value == post.severity)?.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo */}
              <div className="w-full relative border-y border-[#10b981]/20 bg-[#000000]">
                {post.cleanup_image_base64 ? (
                  <div className="grid grid-cols-2">
                    <div className="aspect-square relative">
                      <img src={post.image_base64} alt="Before" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase">Before</div>
                    </div>
                    <div className="aspect-square relative border-l border-[#10b981]/20">
                      <img src={post.cleanup_image_base64} alt="After" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-[#2E6F40]/80 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase">Cleaned</div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-square relative">
                    {post.image_base64 ? (
                      <img src={post.image_base64} alt="Report" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        No Photo
                      </div>
                    )}
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-[#000000]/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-1 border border-[#10b981]/20">
                  <MapPin className="text-zinc-400 w-3 h-3" />
                  <LocationTag lat={post.lat} lng={post.lng} />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 flex justify-between items-center">
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-bold mr-2">{post.username}</span>
                  Raised awareness for a cleanup!
                </p>
                <button 
                  onClick={() => handleSupport(post.id)}
                  disabled={supportedPosts.has(post.id)}
                  className={cn("px-3 py-1.5 rounded-full transition-all group flex items-center space-x-1.5", 
                    supportedPosts.has(post.id) 
                      ? "bg-[#10b981]/20 shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-[#10b981]/50" 
                      : "bg-[#10b981]/5 hover:bg-[#10b981]/10 border border-transparent"
                  )}
                >
                  <Megaphone className={cn("w-5 h-5 transition-colors", supportedPosts.has(post.id) ? "text-[#10b981]" : "text-zinc-400 group-hover:text-white")} />
                  <span className={cn("text-sm font-semibold transition-colors", supportedPosts.has(post.id) ? "text-[#10b981]" : "text-zinc-400 group-hover:text-white")}>
                    {post.supports || 0}
                  </span>
                </button>
              </div>
              
              {!post.cleanup_image_base64 && (
                <div className="px-4 pb-4">
                  <button 
                    onClick={() => handleCleanup(post.id)}
                    disabled={isCleaningUp === post.id}
                    className="w-full bg-[#d4af37] hover:bg-[#d4af37]/80 text-[#050505] font-black py-3 rounded-xl transition-colors shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isCleaningUp === post.id ? (
                      <div className="w-5 h-5 border-2 border-[#050505]/30 border-t-[#050505] rounded-full animate-spin" />
                    ) : (
                      <>
                        <CameraIcon className="w-5 h-5 text-[#050505]" />
                        <span>I cleaned this up! (+20 XP)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
