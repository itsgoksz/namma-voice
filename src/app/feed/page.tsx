"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as htmlToImage from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { getCurrentUser, getImageUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Camera as CameraIcon, MapPin, Clock, Megaphone, Info, AlertTriangle, Flame, AlertOctagon, CheckCircle2, Target, Users, Zap, Star, CalendarDays, X } from "lucide-react";
import { cn, compressImageBase64 } from "@/lib/utils";
import { enqueueOfflineTask } from "@/lib/offlineSync";
import { Geolocation } from "@capacitor/geolocation";
import { getFastLocation } from "@/lib/location";
import PublicProfileModal from '@/components/PublicProfileModal';
import SplitXPModal from '@/components/SplitXPModal';
import LocationTag from '@/components/LocationTag';
import GarbageCard from '@/components/GarbageCard';
import { useRouter } from 'next/navigation';

// Haversine formula to calculate distance between two coordinates in meters
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

import { usePostActions, FeedItem } from '@/hooks/usePostActions';


let cachedFeed: FeedItem[] | null = null;

export default function FeedPage() {
  const router = useRouter();

  const handleNavigate = (lat: number, lng: number) => {
    localStorage.setItem('namma_feed_navigate', JSON.stringify({lat, lng}));
    router.push('/');
  };
  const [feed, setFeed] = useState<FeedItem[]>(cachedFeed || []);
  const [loading, setLoading] = useState(!cachedFeed);
  const [isCleaningUp, setIsCleaningUp] = useState<number | null>(null);
  const [volunteeredPosts, setVolunteeredPosts] = useState<Set<number>>(new Set());
  const [activePost, setActivePost] = useState<FeedItem | null>(null);
  const [errorPopup, setErrorPopup] = useState<{ title: string; message: string } | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  const { supportedPosts, handleSupport, handleFlag, handleOrganise, handleUserClick, PostActionModals } = usePostActions({
    onUpdatePost: (id, updater) => setFeed(prev => prev.map(p => p.id === id ? updater(p as any) as any : p)),
    onError: (title, message) => setErrorPopup({ title, message }),
    onSuccess: (title, message) => alert(`${title}\n${message}`),
  });

  // XP Split States
  const [splitModalData, setSplitModalData] = useState<{ id: number, severity: string, imageUrl: string | null } | null>(null);
  const [splitStep, setSplitStep] = useState(1); // 1 = Claim or Split, 2 = Enter Usernames
  const [splitCount, setSplitCount] = useState(2);
  const [splitUsernames, setSplitUsernames] = useState<string[]>(['', '']);
  const [splitError, setSplitError] = useState("");
  const [isSplitting, setIsSplitting] = useState(false);

  const getSeverityXP = (severity: string) => {
    if (severity === 'critical' || severity === 'high') return 50;
    if (severity === 'severe') return 40;
    if (severity === 'moderate' || severity === 'medium') return 30;
    return 20;
  };



  useEffect(() => {
    const volStr = localStorage.getItem('namma_volunteered_posts') || '[]';
    try {
      setVolunteeredPosts(new Set(JSON.parse(volStr)));
    } catch (e) {}
    
    const fetchFeed = async () => {
      try {
        const { data, error } = await supabase.from('reports').select('*');
        if (!error && data) {
          const sortedData = data.sort((a, b) => {
            const ageA = (Date.now() - new Date(a.timestamp).getTime()) / (1000 * 60 * 60);
            const scoreA = ((a.supports || 0) + 1) / Math.pow(ageA + 2, 1.8);
            
            const ageB = (Date.now() - new Date(b.timestamp).getTime()) / (1000 * 60 * 60);
            const scoreB = ((b.supports || 0) + 1) / Math.pow(ageB + 2, 1.8);
            
            return scoreB - scoreA;
          });
          cachedFeed = sortedData;
          setFeed(sortedData);
        }
      } catch (e) {
        console.error("Failed to fetch feed", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
    
    // Switch to Event-Driven Realtime updates instead of polling
    const subscription = supabase
      .channel('public:reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchFeed();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);



  const handleVolunteer = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    
    const isCurrentlyVolunteered = volunteeredPosts.has(id);
    const increment = isCurrentlyVolunteered ? -1 : 1;

    setFeed(prev => prev.map(post => 
      post.id === id ? { ...post, volunteers: Math.max(0, (post.volunteers || 0) + increment) } : post
    ));

    try {
      setVolunteeredPosts(prev => {
        const next = new Set(prev);
        if (isCurrentlyVolunteered) next.delete(id);
        else next.add(id);
        localStorage.setItem('namma_volunteered_posts', JSON.stringify(Array.from(next)));
        return next;
      });
      
      const { data: post } = await supabase.from('reports').select('volunteers').eq('id', id).single();
      if (post) {
        await supabase.from('reports').update({ volunteers: Math.max(0, (post.volunteers || 0) + increment) }).eq('id', id);
      }
    } catch (e) {
      console.error("Failed to toggle volunteer", e);
      setVolunteeredPosts(prev => {
        const next = new Set(prev);
        if (isCurrentlyVolunteered) next.add(id);
        else next.delete(id);
        return next;
      });
      setFeed(prev => prev.map(post => 
        post.id === id ? { ...post, volunteers: Math.max(0, (post.volunteers || 0) - increment) } : post
      ));
    }
  };

  const handleCleanup = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const post = feed.find(p => p.id === id) || cachedFeed?.find(p => p.id === id);
      if (!post) return;

      try {
        try { await Geolocation.requestPermissions(); } catch (e) {}
        const pos = await getFastLocation();
        const dist = getDistanceInMeters(pos.lat, pos.lng, post.lat, post.lng);
        
        if (dist > 50) {
          setErrorPopup({
            title: "Too Far Away",
            message: `You are ${Math.round(dist)}m away from the garbage location. You must be physically present at the exact location to clean it up.`
          });
          return;
        }
      } catch (err) {
        setErrorPopup({
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
          const post = feed.find(p => p.id === id) || cachedFeed?.find(p => p.id === id);
          const severity = post?.severity || 'light';
          
          setSplitModalData({ id, severity, imageUrl });
          setSplitStep(1);
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

  const handleSplitSubmit = async (isSolo = false) => {
    setIsSplitting(true);
    setSplitError("");
    
    try {
      let squad = [getCurrentUser()];
      
      if (!isSolo) {
        const validUsernames = splitUsernames.map(u => u.trim().toLowerCase()).filter(u => u.length > 0);
        const uniqueUsernames = Array.from(new Set(validUsernames));
        
        if (uniqueUsernames.length > 0) {
          const { data: users, error } = await supabase.from('users').select('name').in('name', uniqueUsernames);
          if (error || !users || users.length !== uniqueUsernames.length) {
             setSplitError("One or more usernames do not exist! Please check the usernames and try again.");
             setIsSplitting(false);
             return;
          }
          squad = [getCurrentUser(), ...users.map(u => u.name)];
        }
      }
      const post = feed.find(p => p.id === splitModalData!.id) || cachedFeed?.find(p => p.id === splitModalData!.id);
      if (!post) {
        setSplitError("Could not find report details.");
        setIsSplitting(false);
        return;
      }

      const baseXP = getSeverityXP(splitModalData!.severity);
      let multiplier = 1;
      if (splitModalData!.severity === 'critical' || splitModalData!.severity === 'high') {
        const reportedAt = new Date(post.timestamp).getTime();
        const cleanedAt = new Date().getTime();
        const diffHours = (cleanedAt - reportedAt) / (1000 * 60 * 60);
        if (diffHours <= 24) multiplier = 2;
      }
      const totalXP = baseXP * multiplier;
      const perPerson = Math.floor(totalXP / squad.length);

      // Grant XP to squad
      for (const member of squad) {
        const { data: user } = await supabase.from('users').select('xp, level').eq('name', member).single();
        if (user) {
          const newXp = (user.xp || 0) + perPerson;
          let newLevel = user.level || 1;
          if (newXp >= newLevel * 50) newLevel += 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('name', member);
        }
        
        await supabase.from('notifications').insert([{
          username: member,
          title: "Cleanup Verified!",
          message: `Your cleanup was successfully verified automatically. You earned +${perPerson} XP.`,
          type: 'CLEANUP_REWARD',
          read: false,
          created_at: new Date().toISOString()
        }]);
      }

      // Grant Assist XP to original reporter
      if (!squad.includes(post.username)) {
        const { data: reporter } = await supabase.from('users').select('xp, level').eq('name', post.username).single();
        if (reporter) {
          const newXp = (reporter.xp || 0) + 10;
          let newLevel = reporter.level || 1;
          if (newXp >= newLevel * 50) newLevel += 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('name', post.username);
        }
        await supabase.from('notifications').insert([{
          username: post.username,
          title: "Report Resolved",
          message: `A hazard you reported was cleaned! +10 Assist XP.`,
          type: 'ASSIST_REWARD',
          read: false,
          created_at: new Date().toISOString()
        }]);
      }

      // Grant Delayed Gratification XP to supporters
      const { data: supporters } = await supabase.from('report_supports').select('username').eq('report_id', splitModalData!.id);
      
      if (supporters && supporters.length > 0) {
        const eligibleSupporters = supporters
          .map(s => s.username)
          .filter(u => u.toLowerCase() !== post.username.toLowerCase() && !squad.map(sq => sq.toLowerCase()).includes(u.toLowerCase()));
          
        if (eligibleSupporters.length > 0) {
          const { data: usersToUpdate } = await supabase.from('users').select('name, xp, level').in('name', eligibleSupporters);
          
          if (usersToUpdate) {
            for (const user of usersToUpdate) {
              const newXp = (user.xp || 0) + 5;
              let newLevel = user.level || 1;
              if (newXp >= newLevel * 50) newLevel += 1;
              await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('name', user.name);
            }
          }
          
          const notifications = eligibleSupporters.map(username => ({
            username,
            title: 'Awareness Rewarded!',
            message: `Your support worked! @${getCurrentUser()} just cleaned the spot you supported. +5 Bonus XP!`,
            type: 'SUPPORT_REWARD',
            read: false,
            created_at: new Date().toISOString()
          }));
          
          await supabase.from('notifications').insert(notifications);
        }
      }

      // Update status to CLEANED directly
      await supabase.from('reports').update({ 
        cleanup_image_base64: splitModalData!.imageUrl, 
        status: 'CLEANED',
        cleanup_squad: squad,
        cleanup_timestamp: new Date().toISOString()
      }).eq('id', splitModalData!.id);
      
      setSplitModalData(null);
      setSplitUsernames(['', '']);
      setSplitCount(2);
      
      alert(`✅ Cleanup Verified Instantly!\n\n+${perPerson} XP Awarded\n\nAwesome work!`);
      
      // The realtime subscription will automatically refresh the feed
      const { data } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
      if (data) setFeed(data);
      
    } catch (e) {
      setSplitError("Failed to submit cleanup. Please try again.");
    } finally {
      setIsSplitting(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown time";
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  return (
    <div 
      onScroll={(e) => {
        const isScrolled = e.currentTarget.scrollTop > 20;
        if (isScrolled !== isHeaderHidden) setIsHeaderHidden(isScrolled);
        window.dispatchEvent(new CustomEvent('scrollStateChange', { detail: { isScrolled } }));
      }}
      className={cn(
      "p-4 space-y-6 h-full flex flex-col pt-safe-header pb-[calc(env(safe-area-inset-bottom)+8rem)] max-w-md mx-auto relative z-10",
      (activePost || splitModalData) ? "overflow-hidden touch-none" : "overflow-y-auto"
    )}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: isHeaderHidden ? 0 : 1, 
          y: isHeaderHidden ? -20 : 0,
          pointerEvents: isHeaderHidden ? 'none' : 'auto'
        }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1 w-full max-w-[calc(100%-150px)]"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight truncate w-full">Community</h1>
        <p className="text-zinc-400 text-sm font-medium">Live civic action feed.</p>
      </motion.div>

      {loading && feed.length === 0 ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel rounded-3xl h-[400px] w-full bg-white/5 animate-pulse border border-[#10b981]/20" />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <p className="text-zinc-400">No one has posted yet. Be the first to clean up your neighborhood!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feed.map((post, i) => (
            <GarbageCard
              key={post.id}
              className="h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-15.5rem)] shrink-0"
              layoutId={`post-${post.id}`}
              post={post}
              variant="feed"
              supportedPosts={supportedPosts}
              volunteeredPosts={volunteeredPosts}
              onSupport={handleSupport}
              onFlag={handleFlag}
              onOrganise={handleOrganise}
              onUserClick={(username) => {
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                handleUserClick(username);
              }}
              onCleanupSuccess={(id, severity, imageUrl) => {
                setSplitModalData({ id, severity, imageUrl: imageUrl });
                setSplitStep(1);
                // Refresh feed
                supabase.from('reports').select('*').order('timestamp', { ascending: false }).then(({ data }) => {
                  if (data) setFeed(data as any);
                });
              }}
              setErrorPopup={setErrorPopup}
              onNavigate={handleNavigate}
              onImageClick={() => setActivePost(post)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {activePost && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-4 pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePost(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              layoutId={`post-${activePost.id}`}
              className="relative w-full max-w-md max-h-full overflow-y-auto glass-panel rounded-3xl overflow-hidden border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center">
                <div 
                  className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleUserClick(activePost.username)}
                >
                  <div className="w-10 h-10 bg-[#10b981]/10 rounded-full flex items-center justify-center text-xl border border-[#10b981]/30">👤</div>
                  <div>
                    <p className="text-white font-bold text-sm">{activePost.username}</p>
                    <div className="flex items-center space-x-1 text-xs text-white/70">
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



      {/* XP Splitting Modal */}
      <SplitXPModal 
        isOpen={!!splitModalData}
        onClose={() => setSplitModalData(null)}
        splitModalData={splitModalData}
        splitStep={splitStep}
        setSplitStep={setSplitStep}
        isSplitting={isSplitting}
        splitCount={splitCount}
        setSplitCount={setSplitCount}
        splitUsernames={splitUsernames}
        setSplitUsernames={setSplitUsernames}
        splitError={splitError}
        setSplitError={setSplitError}
        handleSplitSubmit={handleSplitSubmit}
        getSeverityXP={getSeverityXP}
      />



      <AnimatePresence>
        {errorPopup && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setErrorPopup(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-[#ff4d6d]/20 flex items-center justify-center mb-4 border border-[#ff4d6d]/30">
                <AlertTriangle className="w-8 h-8 text-[#ff4d6d]" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">{errorPopup.title}</h2>
              <p className="text-zinc-400 font-medium mb-6 text-sm">{errorPopup.message}</p>
              <button
                onClick={() => setErrorPopup(null)}
                className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-black rounded-xl transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {PostActionModals}
    </div>
  );
}
