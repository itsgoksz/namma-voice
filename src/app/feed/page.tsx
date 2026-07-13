"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as htmlToImage from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { getCurrentUser, getImageUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Camera as CameraIcon, MapPin, Clock, Megaphone, Info, AlertTriangle, Flame, AlertOctagon, CheckCircle2, Target, Users, Zap, Star, CalendarDays } from "lucide-react";
import { cn, compressImageBase64 } from "@/lib/utils";
import { enqueueOfflineTask } from "@/lib/offlineSync";

const SEVERITIES = [
  { value: 'light', label: "Light", color: "text-zinc-400" },
  { value: 'moderate', label: "Moderate", color: "text-[#d4af37]" },
  { value: 'severe', label: "Severe", color: "text-[#ff9f1c]" },
  { value: 'critical', label: "Critical", color: "text-[#ff4d6d]" }
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
  status: string;
  volunteers: number;
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

let cachedFeed: FeedItem[] | null = null;

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>(cachedFeed || []);
  const [loading, setLoading] = useState(!cachedFeed);
  const [isCleaningUp, setIsCleaningUp] = useState<number | null>(null);
  const [supportedPosts, setSupportedPosts] = useState<Set<number>>(new Set());
  const [volunteeredPosts, setVolunteeredPosts] = useState<Set<number>>(new Set());
  const [activePost, setActivePost] = useState<FeedItem | null>(null);
  const [sharePost, setSharePost] = useState<FeedItem | null>(null);
  const [organiseStep, setOrganiseStep] = useState<1 | 2>(1);
  const [organiseDate, setOrganiseDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [organiseTime, setOrganiseTime] = useState("09:00");
  const [organiseLocation, setOrganiseLocation] = useState("");
  const [organiseVolunteers, setOrganiseVolunteers] = useState("15");
  const [shareData, setShareData] = useState<any>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const resetOrganise = () => {
    setSharePost(null);
    setOrganiseStep(1);
    setShareData(null);
    setIsGeneratingPoster(false);
  };

  // Generate poster when step transitions to 2
  useEffect(() => {
    if (!sharePost || organiseStep === 1) return;
    
    setIsGeneratingPoster(true);
    let isCancelled = false;
    
    // Slight delay to ensure DOM is ready and updated with form data
    const timer = setTimeout(async () => {
      if (!posterRef.current || isCancelled) return;
      try {
        const blob = await htmlToImage.toBlob(posterRef.current, { 
          backgroundColor: '#050505',
          pixelRatio: 2, // High quality
          cacheBust: true,
          skipFonts: true,
        });
        
        if (!blob || isCancelled) return;
        const file = new File([blob], 'namma-hood-cleanup.jpg', { type: 'image/jpeg' });
        setShareData({
          files: [file],
          title: 'Namma Hood Cleanup',
          text: `Let's clean up our neighborhood! I'm organising a cleanup at ${organiseLocation}. Join me! 🌍`,
          blob: blob
        });
        setIsGeneratingPoster(false);
      } catch (error) {
        console.error('Error generating poster', error);
        setIsGeneratingPoster(false);
      }
    }, 500);
    
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [sharePost, organiseStep, organiseLocation]);

  useEffect(() => {
    const supportedStr = localStorage.getItem('namma_supported_posts') || '[]';
    const volStr = localStorage.getItem('namma_volunteered_posts') || '[]';
    try {
      setSupportedPosts(new Set(JSON.parse(supportedStr)));
      setVolunteeredPosts(new Set(JSON.parse(volStr)));
    } catch (e) {}
    
    const fetchFeed = async () => {
      try {
        const { data, error } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
        if (!error && data) {
          cachedFeed = data;
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

  const handleSupport = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (supportedPosts.has(id)) return;
    try {
      setSupportedPosts(prev => {
        const next = new Set(prev).add(id);
        localStorage.setItem('namma_supported_posts', JSON.stringify(Array.from(next)));
        return next;
      });
      const { data: post } = await supabase.from('reports').select('supports').eq('id', id).single();
      if (post) {
        await supabase.from('reports').update({ supports: (post.supports || 0) + 1 }).eq('id', id);
      }
      const { data } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
      if (data) setFeed(data);
    } catch (e) {
      console.error("Failed to support", e);
      setSupportedPosts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleVolunteer = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (volunteeredPosts.has(id)) return;
    try {
      setVolunteeredPosts(prev => {
        const next = new Set(prev).add(id);
        localStorage.setItem('namma_volunteered_posts', JSON.stringify(Array.from(next)));
        return next;
      });
      const { data: post } = await supabase.from('reports').select('volunteers').eq('id', id).single();
      if (post) {
        await supabase.from('reports').update({ volunteers: (post.volunteers || 0) + 1 }).eq('id', id);
      }
      const { data } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
      if (data) setFeed(data);
    } catch (e) {
      console.error("Failed to volunteer", e);
      setVolunteeredPosts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleOrganise = async (e: React.MouseEvent, post: FeedItem) => {
    e.stopPropagation();
    setSharePost(post);
    setShareData(null);
    setIsGeneratingPoster(true);
  };

  const handleFinalShare = async () => {
    if (!shareData) return;
    
    try {
      if (navigator.canShare && navigator.canShare({ files: shareData.files })) {
        await navigator.share({
          files: shareData.files,
          title: shareData.title,
          text: shareData.text
        });
      } else {
        // Fallback to download
        const url = URL.createObjectURL(shareData.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'namma-cleanup.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("Poster downloaded! You can now share it manually.");
      }
      setSharePost(null);
    } catch (e) {
      console.log('User cancelled share or error:', e);
      setSharePost(null);
    }
  };

  const handleCleanup = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
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
        const compressedPhoto = await compressImageBase64(photoData);
        let imageUrl = null;
        if (compressedPhoto) {
          try {
            const res = await fetch(compressedPhoto);
            const blob = await res.blob();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const { data, error } = await supabase.storage.from('uploads').upload(fileName, blob, { contentType: 'image/jpeg' });
            if (!error && data) imageUrl = data.path;
          } catch (e) {
            console.error("Storage upload failed", e);
          }
        }
        
        try {
          await supabase.from('reports').update({ cleanup_image_base64: imageUrl, status: 'CLEANED' }).eq('id', id);
          const { data: user } = await supabase.from('users').select('xp').eq('name', getCurrentUser()).single();
          if (user) await supabase.from('users').update({ xp: user.xp + 20 }).eq('name', getCurrentUser());
        } catch (e) {
          console.warn("Network failed", e);
        }
        
        // Refresh feed
        const { data } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
        if (data) setFeed(data);
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
              layoutId={`post-${post.id}`}
              onClick={() => setActivePost(post)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl overflow-hidden border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer"
            >
              {/* Header */}
              <div className="p-4 flex flex-wrap gap-3 justify-between items-center bg-[#10b981]/5">
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
                <div className="flex flex-wrap gap-2">
                  <div className="bg-[#10b981]/5 px-3 py-1 rounded-full border border-[#10b981]/20 flex items-center">
                    <span className="text-[#d4af37] text-xs font-black">+10 Eco XP</span>
                  </div>
                  {post.severity && SEVERITIES.find(s => s.value == post.severity) && (
                    <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 flex items-center space-x-2">
                      <span className={cn("text-xs font-bold", SEVERITIES.find(s => s.value == post.severity)?.color)}>
                        {SEVERITIES.find(s => s.value == post.severity)?.label}
                      </span>
                    </div>
                  )}
                  {post.status === "CLEANED" && (
                    <div className="bg-[#2E6F40]/20 px-3 py-1 rounded-full border border-[#2E6F40]/50 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                      <span className="text-xs font-bold text-[#10b981]">CLEANED</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo */}
              <div className="w-full relative border-y border-[#10b981]/20 bg-[#000000]">
                {post.cleanup_image_base64 ? (
                  <div className="grid grid-cols-2">
                    <div className="aspect-square relative">
                      <img src={getImageUrl(post.image_base64)} alt="Before" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase">Before</div>
                    </div>
                    <div className="aspect-square relative border-l border-[#10b981]/20">
                      <img src={getImageUrl(post.cleanup_image_base64)} alt="After" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      <div className="absolute top-2 left-2 bg-[#2E6F40]/80 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase">Cleaned</div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-square relative">
                    {post.image_base64 ? (
                      <img src={getImageUrl(post.image_base64)} alt="Report" className="w-full h-full object-cover" crossOrigin="anonymous" />
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
              <div className="p-4 flex flex-col space-y-3">
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-bold mr-2">{post.username}</span>
                  Raised awareness for a cleanup!
                </p>
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => handleSupport(e, post.id)}
                      disabled={supportedPosts.has(post.id)}
                      className={cn("px-3 py-2 rounded-full transition-all group flex items-center space-x-1.5", 
                        supportedPosts.has(post.id) 
                          ? "bg-[#ff7f50]/30 shadow-[0_0_20px_rgba(255,127,80,0.6)] border border-[#ff7f50]" 
                          : "bg-[#ff7f50]/10 hover:bg-[#ff7f50]/20 border border-[#ff7f50]/30 shadow-[0_0_15px_rgba(255,127,80,0.2)]"
                      )}
                    >
                      <Megaphone className={cn("w-4 h-4 transition-colors", supportedPosts.has(post.id) ? "text-[#ff7f50]" : "text-[#ff7f50]/80 group-hover:text-[#ff7f50]")} />
                      <span className={cn("text-sm font-semibold transition-colors", supportedPosts.has(post.id) ? "text-[#ff7f50]" : "text-[#ff7f50]/80 group-hover:text-[#ff7f50]")}>
                        {post.supports || 0}
                      </span>
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* {!post.cleanup_image_base64 && (
                      <button 
                        onClick={(e) => handleVolunteer(e, post.id)}
                        disabled={volunteeredPosts.has(post.id)}
                        className={cn("px-3 py-2 rounded-full transition-all flex items-center space-x-1.5",
                          volunteeredPosts.has(post.id)
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                            : "bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/30 text-blue-400/80"
                        )}
                      >
                        <span className="text-xs font-bold">
                          {volunteeredPosts.has(post.id) 
                            ? (post.volunteers > 1 ? `You + ${post.volunteers - 1} volunteering` : "You're volunteering")
                            : (post.volunteers > 0 ? `${post.volunteers} volunteering` : "I'll help clean")}
                        </span>
                      </button>
                    )} */}
                  
                    {!post.cleanup_image_base64 && (
                    <button 
                      onClick={(e) => handleOrganise(e, post)}
                      className="px-3 py-2 rounded-full transition-all flex items-center space-x-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400"
                    >
                      <span className="text-xs font-bold">Organise Cleanup</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
              
            {!post.cleanup_image_base64 && (
                <div className="px-4 pb-4">
                  <button 
                    onClick={(e) => handleCleanup(e, post.id)}
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

      <AnimatePresence>
        {activePost && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-4 pt-12 pb-28">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePost(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              layoutId={`post-${activePost.id}`}
              className="relative w-full max-w-md max-h-full overflow-y-auto glass-panel rounded-3xl overflow-hidden border border-[#10b981]/20 bg-[#0a0a0a] shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center bg-[#10b981]/5">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#10b981]/5 rounded-full flex items-center justify-center text-xl border border-[#10b981]/20">👤</div>
                  <div>
                    <p className="text-white font-bold text-sm">{activePost.username}</p>
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-400">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(activePost.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo */}
              <div className="w-full relative border-y border-[#10b981]/20 bg-[#000000]">
                {activePost.cleanup_image_base64 ? (
                  <div className="flex flex-col space-y-1 bg-black">
                    <div className="relative">
                      <img src={getImageUrl(activePost.image_base64)} alt="Before" className="w-full max-h-[40vh] object-contain bg-[#050505]" crossOrigin="anonymous" />
                      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-black text-white tracking-widest uppercase border border-white/10 shadow-xl">Before</div>
                    </div>
                    <div className="relative">
                      <img src={getImageUrl(activePost.cleanup_image_base64)} alt="After" className="w-full max-h-[40vh] object-contain bg-[#050505]" crossOrigin="anonymous" />
                      <div className="absolute top-4 left-4 bg-[#2E6F40]/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-black text-white tracking-widest uppercase border border-[#2E6F40]/50 shadow-xl">Cleaned</div>
                    </div>
                  </div>
                ) : (
                  <div className="relative bg-[#050505] flex-1 flex flex-col justify-center">
                    {activePost.image_base64 ? (
                      <img src={getImageUrl(activePost.image_base64)} alt="Report" className="w-full max-h-[70vh] object-contain" crossOrigin="anonymous" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-white/20">No Photo</div>
                    )}
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-[#000000]/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center space-x-1 border border-[#10b981]/20">
                  <MapPin className="text-zinc-400 w-4 h-4" />
                  <LocationTag lat={activePost.lat} lng={activePost.lng} />
                </div>
              </div>

              <div className="p-4 flex justify-between items-center">
                <button
                  onClick={() => setActivePost(null)}
                  className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Preview Modal */}
      <AnimatePresence>
        {sharePost && (
          <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={() => setSharePost(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm glass-panel rounded-3xl p-6 flex flex-col items-center z-10 border border-[#10b981]/30 bg-[#050505] shadow-[0_0_50px_rgba(16,185,129,0.3)]"
            >
              {organiseStep === 1 ? (
                <div className="w-full flex flex-col space-y-4">
                  <h2 className="text-xl font-bold text-white mb-2 text-center">Organise Cleanup</h2>
                  
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Date</label>
                    <input 
                      type="date" 
                      value={organiseDate}
                      onChange={e => setOrganiseDate(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff7f50]"
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Time</label>
                    <input 
                      type="time" 
                      value={organiseTime}
                      onChange={e => setOrganiseTime(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff7f50]"
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Meeting Point</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Near the main gate"
                      value={organiseLocation}
                      onChange={e => setOrganiseLocation(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff7f50]"
                    />
                  </div>

                  <div className="flex flex-col space-y-1 mb-4">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Volunteers Needed</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 15"
                      value={organiseVolunteers}
                      onChange={e => setOrganiseVolunteers(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff7f50]"
                    />
                  </div>

                  <div className="w-full flex space-x-3 mt-4">
                    <button 
                      onClick={resetOrganise}
                      className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setOrganiseStep(2)}
                      disabled={!organiseDate || !organiseTime || !organiseLocation || !organiseVolunteers}
                      className="flex-[2] py-3 rounded-xl bg-[#ff7f50] hover:bg-[#ff7f50]/90 text-black font-black transition-colors disabled:opacity-50"
                    >
                      Generate Poster
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-2 text-center">Ready to Organise!</h2>
                  <p className="text-zinc-400 text-xs text-center mb-6">A custom cleanup poster has been generated for you.</p>
                  
                  <div className="w-full aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
                    {shareData && shareData.blob ? (
                      <img src={URL.createObjectURL(shareData.blob)} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-[#ff7f50]/20 border-t-[#ff7f50] rounded-full animate-spin mb-3" />
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Generating Poster...</p>
                      </div>
                    )}
                  </div>

                  <div className="w-full flex space-x-3">
                    <button 
                      onClick={() => setOrganiseStep(1)}
                      className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleFinalShare}
                      disabled={!shareData || isGeneratingPoster}
                      className="flex-[2] py-3 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 text-black font-black transition-colors shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:shadow-none"
                    >
                      Share Poster
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Share Poster rendering element */}
      {sharePost && (
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', zIndex: -10 }}>
          <div 
            ref={posterRef} 
            className="w-[1080px] h-[1920px] bg-[#041f14] flex flex-col font-sans relative overflow-hidden"
          >
            {/* The Actual Garbage Image as Background with Soft Environmental Blur */}
            {sharePost.image_base64 && (
              <div className="absolute inset-0 z-0">
                <img 
                  src={getImageUrl(sharePost.image_base64)} 
                  crossOrigin="anonymous" 
                  alt="Background" 
                  className="w-full h-full object-cover mix-blend-luminosity opacity-25 blur-[24px] scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#041f14] via-[#041f14]/80 to-transparent" />
              </div>
            )}

            {/* Glowing Nature Orbs for ambiance */}
            <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#10b981] rounded-full blur-[250px] opacity-20" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[1000px] h-[1000px] bg-[#34d399] rounded-full blur-[250px] opacity-10" />

            {/* Subtle Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_2px,transparent_2px),linear-gradient(to_bottom,#ffffff02_2px,transparent_2px)] bg-[size:64px_64px] z-0 mix-blend-overlay pointer-events-none" />

            {/* Top Minimalist Info */}
            <div className="relative z-10 flex justify-between items-start px-16 pt-16">
              <div className="flex flex-col">
                <span className="text-white text-3xl font-black tracking-widest uppercase flex items-center space-x-3 mb-2 opacity-90">
                  <Target className="w-8 h-8 text-[#10b981]" />
                  <span>NAMMA HOOD</span>
                </span>
                <span className="text-[#10b981]/70 font-mono text-xl tracking-widest uppercase">Community Cleanup Initiative</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-white/70 font-mono text-xl tracking-widest bg-black/20 px-5 py-2 rounded-2xl backdrop-blur-md border border-white/10 shadow-sm">
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Title / Hero */}
            <div className="relative z-10 px-16 pt-32 pb-16 flex flex-col border-b border-white/5">
              <h1 className="text-white text-[9rem] font-black leading-[0.9] tracking-tight uppercase mb-12">
                <span className="text-white/80 font-bold text-6xl tracking-wider">Community</span> <br/>
                <span className="text-[#10b981] drop-shadow-[0_10px_30px_rgba(16,185,129,0.3)]">Cleanup</span>
              </h1>
              
              <div className="flex items-center space-x-6 bg-white/5 backdrop-blur-3xl px-8 py-6 rounded-[3rem] border border-white/10 shadow-xl self-start">
                <div className="w-24 h-24 overflow-hidden rounded-full border-4 border-[#10b981] shadow-lg">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getCurrentUser()}`} alt="Avatar" className="w-full h-full bg-zinc-800" />
                </div>
                <div className="flex flex-col">
                  <p className="text-[#10b981] text-lg font-bold uppercase tracking-widest mb-1">Organised By</p>
                  <p className="text-white text-4xl font-black">@{getCurrentUser()}</p>
                  <p className="text-white/50 text-md font-semibold tracking-wide mt-1">Level {Math.floor(sharePost.supports / 10) + 1} Organiser</p>
                </div>
              </div>
            </div>

            {/* The Details Grid (Soft, Rounded, Earthy Premium) */}
            <div className="relative z-10 flex-1 px-16 pt-16 flex flex-col space-y-6">
              
              <div className="flex items-stretch space-x-6">
                <div className="flex-1 bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><MapPin className="w-48 h-48 text-white" /></div>
                  <div className="flex items-center space-x-3 mb-6">
                    <MapPin className="w-8 h-8 text-[#10b981]" />
                    <span className="text-[#10b981] text-2xl font-bold uppercase tracking-widest">Location</span>
                  </div>
                  <span className="text-white text-6xl font-black leading-tight">{organiseLocation}</span>
                </div>
                
                <div className="w-[420px] bg-[#d4af37]/10 backdrop-blur-3xl p-10 rounded-[3rem] border border-[#d4af37]/30 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-48 h-48 text-[#d4af37]" /></div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Zap className="w-8 h-8 text-[#d4af37]" />
                    <span className="text-[#d4af37] text-2xl font-bold uppercase tracking-widest">Reward</span>
                  </div>
                  <span className="text-[#d4af37] text-7xl font-black drop-shadow-[0_5px_15px_rgba(212,175,55,0.3)]">+50 XP</span>
                </div>
              </div>

              <div className="flex items-stretch space-x-6">
                <div className="flex-1 bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><Star className="w-48 h-48 text-white" /></div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Star className="w-8 h-8 text-[#ff7f50]" />
                    <span className="text-[#ff7f50] text-2xl font-bold uppercase tracking-widest">Severity</span>
                  </div>
                  <span className="text-white text-7xl font-black tracking-widest">
                    {sharePost.severity === 'critical' ? '★★★' : sharePost.severity === 'moderate' ? '★★☆' : '★☆☆'}
                  </span>
                </div>
                
                <div className="flex-1 bg-[#10b981]/10 backdrop-blur-3xl p-10 rounded-[3rem] border border-[#10b981]/30 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><Users className="w-48 h-48 text-[#10b981]" /></div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Users className="w-8 h-8 text-[#10b981]" />
                    <span className="text-[#10b981] text-2xl font-bold uppercase tracking-widest">Volunteers Needed</span>
                  </div>
                  <span className="text-white text-7xl font-black">{organiseVolunteers || (sharePost.volunteers > 0 ? sharePost.volunteers : 15)}</span>
                </div>
              </div>
              
              <div className="w-full bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><CalendarDays className="w-48 h-48 text-white" /></div>
                <div className="flex items-center space-x-3 mb-6">
                  <CalendarDays className="w-8 h-8 text-[#10b981]" />
                  <span className="text-[#10b981] text-2xl font-bold uppercase tracking-widest">Date & Time</span>
                </div>
                <span className="text-white text-6xl font-black uppercase tracking-wider">{new Date(organiseDate).toLocaleDateString('en-US', { weekday: 'long' })} @ {organiseTime}</span>
              </div>
            </div>

            {/* Footer QR Code Section - Elegant Modern Theme */}
            <div className="relative z-10 w-full bg-[#10b981] p-16 flex justify-between items-center mt-12 rounded-t-[4rem] shadow-[0_-10px_40px_rgba(16,185,129,0.2)]">
              <div className="flex flex-col relative z-10">
                <h2 className="text-black text-[7rem] font-black tracking-tighter mb-4 leading-[0.9]">SCAN TO <br/>JOIN</h2>
                <div className="flex items-center space-x-6 mt-2">
                  <span className="bg-black/10 text-black px-6 py-2 rounded-full font-bold text-3xl uppercase tracking-wider">nammahood.com</span>
                </div>
              </div>
              <div className="relative z-10 w-[260px] h-[260px] bg-white p-6 rounded-3xl shadow-xl flex items-center justify-center rotate-2">
                <QRCodeSVG value={`https://nammahood.com/event/${sharePost.id}`} size={212} />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
