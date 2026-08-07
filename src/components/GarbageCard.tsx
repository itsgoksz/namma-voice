import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Megaphone, AlertTriangle, CheckCircle2, Camera as CameraIcon, Navigation } from "lucide-react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { supabase } from "@/lib/supabase";
import { getImageUrl, getCurrentUser } from "@/lib/api";
import { compressImageBase64, cn } from "@/lib/utils";
import { getFastLocation } from "@/lib/location";
import LocationTag from "@/components/LocationTag";

// Helper from feed
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const SEVERITIES = [
  { value: 'light', label: "Light", color: "text-zinc-400" },
  { value: 'moderate', label: "Moderate", color: "text-[#d4af37]" },
  { value: 'severe', label: "Severe", color: "text-[#ff9f1c]" },
  { value: 'critical', label: "Critical", color: "text-[#ff4d6d]" }
];

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getSeverityXP(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 50;
    case 'severe':
      return 40;
    case 'medium':
    case 'moderate':
      return 30;
    case 'low':
    default:
      return 20;
  }
}

import { FeedItem } from '@/hooks/usePostActions';
export type { FeedItem };

interface GarbageCardProps {
  post: FeedItem;
  variant: "feed" | "map";
  className?: string;
  supportedPosts?: Set<number>;
  volunteeredPosts?: Set<number>;
  onSupport?: (e: React.MouseEvent, id: number) => void;
  onFlag?: (e: React.MouseEvent, post: FeedItem) => void;
  onOrganise?: (e: React.MouseEvent, post: FeedItem) => void;
  onUserClick?: (username: string) => void;
  onCleanupSuccess?: (id: number, severity: string, imageUrl: string | null) => void;
  setErrorPopup?: (error: {title: string, message: string} | null) => void;
  onNavigate?: (lat: number, lng: number) => void;
  onImageClick?: () => void;
  layoutId?: string;
}

export default function GarbageCard({
  post,
  variant,
  supportedPosts = new Set(),
  volunteeredPosts = new Set(),
  onSupport,
  onFlag,
  onOrganise,
  onUserClick,
  onCleanupSuccess,
  setErrorPopup,
  onNavigate,
  onImageClick,
  layoutId,
  className
}: GarbageCardProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleCleanup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      try { await Geolocation.requestPermissions(); } catch (err) {}
      const userLoc = await getFastLocation();
      const d = getDistanceInMeters(userLoc.lat, userLoc.lng, post.lat, post.lng);
      
      if (d > 50) {
        if (setErrorPopup) {
          setErrorPopup({
            title: "Too Far Away!",
            message: `You need to be within 50 meters of the garbage spot to clean it. You are currently ${Math.round(d)} meters away.`
          });
        }
        return;
      }
    } catch (err) {
      setErrorPopup?.({
        title: "Location Failed",
        message: "Failed to get your location. Please enable GPS to clean up this spot."
      });
      return;
    }

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
      setIsCleaningUp(true);
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
        const { error } = await supabase.from('reports').update({
          status: 'CLEANED',
          cleanup_image_base64: imageUrl || null,
          cleanup_timestamp: new Date().toISOString(),
          cleanup_squad: [getCurrentUser()]
        }).eq('id', post.id);

        if (!error) {
          onCleanupSuccess?.(post.id, post.severity || 'light', imageUrl);
        }
      } catch (e) {
        console.error("Failed to cleanup", e);
      } finally {
        setIsCleaningUp(false);
      }
    }
  };

  const isMap = variant === "map";

  return (
    <motion.div 
      layoutId={layoutId}
      initial={isMap ? { opacity: 0, scale: 0.8, y: 15 } : { opacity: 0, y: 20 }}
      animate={isMap ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
      exit={isMap ? { opacity: 0, scale: 0.8, y: 15 } : { opacity: 0, y: 150, scale: 0.95 }}
      transition={isMap ? { type: "spring", stiffness: 400, damping: 25 } : { type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "glass-panel rounded-3xl overflow-hidden border border-white/5 flex flex-col",
        isMap ? "text-center font-bold items-center bg-zinc-900 p-0 shadow-xl w-72 sm:w-80 relative" : "shadow-lg bg-black/40 relative z-10 w-full",
        className
      )}
    >
      {/* Header (Only in Feed) */}
      {!isMap && (
        <div className="p-4 pb-3 flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => onUserClick?.(post.username)}>
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}`} alt="Avatar" className="w-full h-full" />
              </div>
              <button 
                className="text-white font-bold text-sm hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                  onUserClick?.(post.username);
                }}
              >
                {post.username}
              </button>
            </div>
            <div className="flex items-center space-x-1 text-xs text-white/70">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(post.timestamp)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end max-w-[50%]">
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
      )}

      {/* Photo */}
      <div 
        className={cn(
          "w-full relative bg-[#000000] flex-1",
          isMap ? "p-3 pb-0 cursor-pointer" : "min-h-[250px] border-y border-[#10b981]/20 cursor-pointer active:scale-[0.98] transition-transform"
        )}
        onClick={() => { if (onImageClick) onImageClick(); }}
      >
        {post.cleanup_image_base64 ? (
          <div className="grid grid-cols-2 gap-1">
            <div className={cn("relative", isMap ? "aspect-[4/3]" : "aspect-square")}>
              <img src={getImageUrl(post.image_base64 || "")} alt="Before" className={cn("w-full h-full object-cover", isMap ? "rounded-l-lg" : "")} crossOrigin="anonymous" />
              <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase">Before</div>
            </div>
            <div className={cn("relative border-l border-[#10b981]/20", isMap ? "aspect-[4/3]" : "aspect-square")}>
              <img src={getImageUrl(post.cleanup_image_base64)} alt="After" className={cn("w-full h-full object-cover", isMap ? "rounded-r-lg" : "")} crossOrigin="anonymous" />
              <div className="absolute top-2 left-2 bg-[#2E6F40]/80 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase">Cleaned</div>
            </div>
          </div>
        ) : (
          <div className={cn("w-full relative", isMap ? "aspect-[4/3]" : "h-full")}>
            {post.image_base64 ? (
              <img src={getImageUrl(post.image_base64)} alt="Report" className={cn("w-full h-full object-cover", isMap ? "rounded-lg" : "")} crossOrigin="anonymous" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                No Photo
              </div>
            )}
          </div>
        )}
        
        {!isMap && (
          <div className="absolute bottom-3 left-3 bg-[#000000]/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-1 border border-[#10b981]/20">
            <MapPin className="text-zinc-400 w-3 h-3" />
            <LocationTag lat={post.lat} lng={post.lng} />
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      {isMap ? (
        <div className="p-3 w-full flex flex-col items-center">
          {post.status === 'CLEANED' ? (
             <>
               <span className="text-[#10b981] text-lg mt-1 tracking-tight">Cleaned</span>
               <span className="text-xs text-slate-500/80 uppercase tracking-widest font-black mb-2">Restored Area</span>
             </>
          ) : (
             <>
               <span className="text-[#ff4d6d] text-lg mt-1 tracking-tight">Active Hazard</span>
               <span className="text-xs text-slate-500/80 uppercase tracking-widest font-black mb-2">Needs Cleanup</span>
             </>
          )}

          <div className="w-full flex space-x-2">
            {!post.cleanup_image_base64 && (
              <button 
                onClick={handleCleanup}
                disabled={isCleaningUp}
                className="flex-1 bg-[#10b981]/25 active:bg-[#10b981]/40 text-[#10b981] border border-[#10b981]/40 font-black py-2 rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center space-x-1 disabled:opacity-50 text-xs"
              >
                {isCleaningUp ? (
                  <div className="w-4 h-4 border-2 border-[#10b981]/30 border-t-[#10b981] rounded-full animate-spin" />
                ) : (
                  <>
                    <CameraIcon className="w-4 h-4" />
                    <span>Clean</span>
                  </>
                )}
              </button>
            )}
            
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.(post.lat, post.lng);
                }}
                className="flex-1 bg-[#f14f4f] hover:bg-[#f14f4f]/90 text-white font-black py-2 rounded-xl flex justify-center items-center space-x-1 shadow-md transition-colors text-xs"
              >
                <Navigation className="w-4 h-4" />
              <span>Navigate</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 flex flex-col space-y-3">
          <p className="text-sm text-zinc-400">
            <button 
              className="text-white font-bold mr-2 hover:underline focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                onUserClick?.(post.username);
              }}
            >
              {post.username}
            </button>
            Raised awareness for a cleanup!
          </p>
          <div className="flex items-center justify-between space-x-2">
            <div className="flex space-x-2">
              <button 
                onClick={(e) => onSupport?.(e, post.id)}
                className={cn("px-3 py-2 rounded-full transition-all group flex items-center space-x-1.5", 
                  supportedPosts.has(post.id) 
                    ? "bg-[#ff4d6d]/20 shadow-[0_0_20px_rgba(255,77,109,0.3)] border border-[#ff4d6d]/50" 
                    : "bg-white/5 hover:bg-white/10 border border-white/10 shadow-none"
                )}
              >
                <Megaphone className={cn("w-4 h-4 transition-colors", supportedPosts.has(post.id) ? "text-[#ff4d6d]" : "text-white/60 group-hover:text-white")} />
                <span className={cn("text-sm font-semibold transition-colors", supportedPosts.has(post.id) ? "text-[#ff4d6d]" : "text-white/60 group-hover:text-white")}>
                  {post.supports || 0}
                </span>
              </button>
              <button
                onClick={(e) => onFlag?.(e, post)}
                className={cn("px-3 py-2 rounded-full transition-all group flex items-center space-x-1.5",
                  localStorage.getItem(`namma_flagged_${post.id}`)
                    ? "bg-red-500/20 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : "bg-white/5 hover:bg-white/10 border border-white/10 shadow-none"
                )}
              >
                <AlertTriangle className={cn("w-4 h-4 transition-colors", localStorage.getItem(`namma_flagged_${post.id}`) ? "text-red-500" : "text-white/60 group-hover:text-white")} />
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              {!post.cleanup_image_base64 && (
              <button 
                onClick={(e) => onOrganise?.(e, post)}
                className="px-3 py-2 rounded-full transition-all flex items-center space-x-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400"
              >
                <span className="text-xs font-bold">Organise Cleanup</span>
              </button>
            )}
          </div>
        </div>
          
        {!post.cleanup_image_base64 && (
            <div className="pt-2 flex flex-row space-x-2 w-full">
              <button 
                onClick={handleCleanup}
                disabled={isCleaningUp}
                className="flex-[3] bg-[#10b981]/25 active:bg-[#10b981]/40 text-[#10b981] border border-[#10b981]/40 font-black py-3 px-2 rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {isCleaningUp ? (
                  <div className="w-5 h-5 border-2 border-[#10b981]/30 border-t-[#10b981] rounded-full animate-spin" />
                ) : (
                  <>
                    <CameraIcon className="w-5 h-5 text-[#10b981] shrink-0" />
                    <span className="text-sm leading-tight">Clean! (+{getSeverityXP(post.severity || 'light')} XP)</span>
                  </>
                )}
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.(post.lat, post.lng);
                }}
                className="flex-[2] bg-[#f14f4f] hover:bg-[#f14f4f]/90 text-white font-black py-3 px-2 rounded-xl flex items-center justify-center space-x-1.5 shadow-md transition-colors"
              >
                <Navigation className="w-5 h-5 shrink-0" />
                <span className="text-sm leading-tight">Navigate</span>
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
