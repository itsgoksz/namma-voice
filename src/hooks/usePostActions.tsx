import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, X, Target } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase } from '@/lib/supabase';
import { getCurrentUser, getImageUrl } from '@/lib/api';
import LocationTag from '@/components/LocationTag';
import PublicProfileModal from '@/components/PublicProfileModal';
import { createPortal } from 'react-dom';

export interface FeedItem {
  id: number;
  lat: number;
  lng: number;
  image_base64?: string;
  cleanup_image_base64?: string | null;
  timestamp: string;
  cleanup_timestamp?: string | null;
  username: string;
  cleanup_squad?: string[] | null;
  severity?: string;
  supports?: number;
  flags?: number;
  status?: string;
  volunteers?: number;
}

interface UsePostActionsProps {
  onUpdatePost: (id: number, updater: (post: FeedItem) => FeedItem) => void;
  onError?: (title: string, message: string) => void;
  onSuccess?: (title: string, message: string) => void;
}

export function usePostActions({ onUpdatePost, onError, onSuccess }: UsePostActionsProps) {
  const [supportedPosts, setSupportedPosts] = useState<Set<number>>(new Set());
  const [flagModalPost, setFlagModalPost] = useState<FeedItem | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [isFlagging, setIsFlagging] = useState(false);
  
  const [selectedPublicUser, setSelectedPublicUser] = useState<string | null>(null);
  
  const [sharePost, setSharePost] = useState<FeedItem | null>(null);
  const [organiseStep, setOrganiseStep] = useState(1);
  const [organiseDate, setOrganiseDate] = useState("");
  const [organiseTime, setOrganiseTime] = useState("");
  const [organiseLocation, setOrganiseLocation] = useState("");
  const [organiseVolunteers, setOrganiseVolunteers] = useState("");
  const [shareData, setShareData] = useState<{url: string, base64: string} | null>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('namma_supported_posts');
    if (saved) {
      try {
        setSupportedPosts(new Set(JSON.parse(saved)));
      } catch (e) {}
    }
  }, []);

  const handleSupport = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    
    const isCurrentlySupported = supportedPosts.has(id);
    const increment = isCurrentlySupported ? -1 : 1;

    onUpdatePost(id, post => ({ ...post, supports: Math.max(0, (post.supports || 0) + increment) }));

    try {
      setSupportedPosts(prev => {
        const next = new Set(prev);
        if (isCurrentlySupported) {
          next.delete(id);
        } else {
          next.add(id);
          const today = new Date().toISOString().split('T')[0];
          const dailyKey = `namma_supported_count_${today}`;
          const dailyCount = parseInt(localStorage.getItem(dailyKey) || '0') + 1;
          localStorage.setItem(dailyKey, dailyCount.toString());
        }
        localStorage.setItem('namma_supported_posts', JSON.stringify(Array.from(next)));
        return next;
      });

      const { data: post } = await supabase.from('reports').select('supports').eq('id', id).single();
      if (post) {
        await supabase.from('reports').update({ supports: Math.max(0, (post.supports || 0) + increment) }).eq('id', id);
        if (isCurrentlySupported) {
          await supabase.from('report_supports').delete().eq('report_id', id).eq('username', getCurrentUser());
        } else {
          await supabase.from('report_supports').insert([{ report_id: id, username: getCurrentUser() }]);
        }
      }
    } catch (e) {
      console.error("Failed to toggle support", e);
      setSupportedPosts(prev => {
        const next = new Set(prev);
        if (isCurrentlySupported) next.add(id);
        else next.delete(id);
        return next;
      });
      onUpdatePost(id, post => ({ ...post, supports: Math.max(0, (post.supports || 0) - increment) }));
    }
  };

  const handleFlag = async (e: React.MouseEvent, post: FeedItem) => {
    e.stopPropagation();
    const flagKey = `namma_flagged_${post.id}`;
    if (localStorage.getItem(flagKey)) {
      try {
        await supabase.from('post_flags').delete().eq('report_id', post.id).eq('flagged_by', getCurrentUser());
        const { data: reportData } = await supabase.from('reports').select('flags').eq('id', post.id).maybeSingle();
        if (reportData && reportData.flags > 0) {
          await supabase.from('reports').update({ flags: reportData.flags - 1 }).eq('id', post.id);
        }
        localStorage.removeItem(flagKey);
        onUpdatePost(post.id, p => ({ ...p, flags: Math.max(0, (p.flags || 0) - 1) }));
      } catch (err) {}
      return;
    }
    setFlagModalPost(post);
    setFlagReason("");
  };

  const submitFlag = async () => {
    if (!flagModalPost) return;
    if (flagReason.trim().length < 4) {
      alert("Please provide a valid reason (at least 4 characters).");
      return;
    }
    setIsFlagging(true);
    const post = flagModalPost;
    const flagKey = `namma_flagged_${post.id}`;
    
    try {
      const { error } = await supabase.from('post_flags').insert([{ report_id: post.id, flagged_by: getCurrentUser(), reason: flagReason.trim() }]);
      if (error) throw error;
      
      const { data: reportData } = await supabase.from('reports').select('flags').eq('id', post.id).maybeSingle();
      if (reportData) {
        await supabase.from('reports').update({ flags: (reportData.flags || 0) + 1 }).eq('id', post.id);
      }
      
      localStorage.setItem(flagKey, 'true');
      onUpdatePost(post.id, p => ({ ...p, flags: (p.flags || 0) + 1 }));
      setFlagModalPost(null);
      if (onSuccess) onSuccess("Flagged", "This post has been flagged for Admin Review.");
    } catch (err: any) {
      console.error("Failed to flag", err);
      if (onError) onError("Flag Failed", `Failed to flag. ${err.message || ''}`);
    } finally {
      setIsFlagging(false);
    }
  };

  const handleOrganise = (e: React.MouseEvent, post: FeedItem) => {
    e.stopPropagation();
    setSharePost(post);
    setOrganiseStep(1);
    setOrganiseDate("");
    setOrganiseTime("");
    setOrganiseLocation("");
    setOrganiseVolunteers("");
    setShareData(null);
  };

  const resetOrganise = () => {
    setSharePost(null);
    setOrganiseStep(1);
    setShareData(null);
  };

  useEffect(() => {
    if (organiseStep === 2 && sharePost && posterRef.current && !shareData) {
      const generatePoster = async () => {
        setIsGeneratingPoster(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 800));
          if (!posterRef.current) return;
          const dataUrl = await htmlToImage.toJpeg(posterRef.current, { 
            backgroundColor: '#050505',
            pixelRatio: 2,
            cacheBust: true,
            skipFonts: true,
          });
          
          if (dataUrl) {
            setShareData({ url: dataUrl, base64: dataUrl.split(',')[1] });
          }
          setIsGeneratingPoster(false);
        } catch (err) {
          console.error("Error generating poster:", err);
          setIsGeneratingPoster(false);
          if (onError) onError("Generation Failed", "Failed to generate poster. Please try again.");
          setOrganiseStep(1);
        }
      };
      generatePoster();
    }
  }, [organiseStep, sharePost, shareData, onError]);

  const handleFinalShare = async () => {
    if (!shareData) return;
    try {
      let isNativeShared = false;
      
      try {
        const fileName = `cleanup-poster-${sharePost?.id}-${Date.now()}.jpg`;
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: shareData.base64,
          directory: Directory.Cache
        });
        
        await Share.share({
          title: 'Organise Cleanup',
          text: `Join my cleanup at ${organiseLocation} on ${organiseDate} at ${organiseTime}! We need ${organiseVolunteers} volunteers.`,
          url: savedFile.uri,
          dialogTitle: 'Share Poster'
        });
        isNativeShared = true;
      } catch (capErr) {
        console.warn("Capacitor share failed, falling back to web", capErr);
      }
      
      if (!isNativeShared) {
        const link = document.createElement('a');
        link.href = shareData.url;
        link.download = `cleanup-poster-${sharePost?.id}.jpg`;
        link.click();
      }
      
      const today = new Date().toISOString().split('T')[0];
      const sharedKey = `namma_poster_shared_${today}`;
      if (!localStorage.getItem(sharedKey)) {
        const { data: user } = await supabase.from('users').select('xp, level').eq('name', getCurrentUser()).single();
        if (user) {
          const newXp = (user.xp || 0) + 40;
          let newLevel = user.level || 1;
          if (newXp >= newLevel * 50) newLevel += 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('name', getCurrentUser());
          localStorage.setItem(sharedKey, 'true');
          if (onSuccess) onSuccess("XP Awarded!", "You earned 40 XP for sharing a cleanup poster!");
        }
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  const Modals = (
    <>
      <AnimatePresence>
        {flagModalPost && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFlagModalPost(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col pointer-events-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-red-500 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Flag Report
                </h2>
                <button onClick={() => setFlagModalPost(null)} className="text-white/50 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-zinc-300 mb-4 font-medium">
                Why are you flagging this post?
              </p>
              
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g. Fake cleanup, incorrect location..."
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 mb-6 min-h-[100px] resize-none text-sm font-medium"
              />
              
              <button
                onClick={submitFlag}
                disabled={isFlagging || flagReason.trim().length < 4}
                className="w-full py-3.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isFlagging ? 'Submitting...' : 'Submit Flag'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPublicUser && (
          <PublicProfileModal 
            key="public-profile-modal"
            username={selectedPublicUser} 
            onClose={() => {
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
              setSelectedPublicUser(null);
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sharePost && (
          <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm pointer-events-auto"
              onClick={() => setSharePost(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm glass-panel rounded-3xl p-6 flex flex-col items-center z-10 border border-[#10b981]/30 bg-[#050505] shadow-[0_0_50px_rgba(16,185,129,0.3)] pointer-events-auto"
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
                    {shareData && shareData.url ? (
                      <img src={shareData.url} alt="Preview" className="w-full h-full object-contain" />
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
            className="w-[1080px] h-[1920px] bg-[#020604] flex flex-col overflow-hidden text-white relative"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {/* Cinematic Background Layer */}
            {sharePost?.image_base64 && (
              <div className="absolute inset-0 z-0 bg-[#020604]">
                <img src={getImageUrl(sharePost.image_base64)} alt="Background" className="w-full h-full object-cover opacity-20" crossOrigin="anonymous" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(2,6,4,0.7) 0%, rgba(2,6,4,0.85) 50%, rgba(2,6,4,0.95) 100%)' }} />
              </div>
            )}

            {/* Huge Glow Effects without CSS filters */}
            <div className="absolute top-[-10%] left-[-20%] w-[1200px] h-[1200px]" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-10%] right-[-20%] w-[1200px] h-[1200px]" style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)' }} />
            
            {/* Technical Dot Grid overlay */}
            <div className="absolute inset-0 z-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.4) 1.5px, transparent 0)', backgroundSize: '40px 40px' }} />

            {/* Header */}
            <div className="relative z-10 w-full px-16 pt-20 flex justify-between items-center">
              <div className="bg-white/10 border border-white/20 px-8 py-5 rounded-full flex items-center space-x-4 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                <Target className="w-12 h-12 text-[#10b981]" />
                <span className="text-white text-3xl font-black tracking-widest uppercase">NAMMA HOOD</span>
              </div>
              <div className="bg-[#10b981] text-black font-black px-8 py-5 rounded-full text-2xl tracking-widest uppercase shadow-[0_0_40px_rgba(16,185,129,0.5)]">
                Community Initiative
              </div>
            </div>

            {/* Massive Hero Typography */}
            <div className="relative z-10 px-16 mt-28 flex flex-col">
              <span className="text-[#10b981] font-mono text-5xl tracking-[0.4em] uppercase mb-4 font-bold" style={{ textShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>Operation</span>
              <h1 className="text-white text-[13rem] font-black leading-[0.85] tracking-tighter uppercase" style={{ textShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                CLEANUP <br/>
                <span className="text-[#10b981]">DRIVE</span>
              </h1>
            </div>

            {/* Organizer Badge */}
            <div className="relative z-20 px-16 mt-16 flex items-center">
              <div className="flex items-center space-x-6 bg-white/15 px-8 py-6 rounded-full border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                <div className="w-24 h-24 overflow-hidden rounded-full border-4 border-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.4)] bg-zinc-900">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getCurrentUser()}`} alt="Avatar" className="w-full h-full" crossOrigin="anonymous" />
                </div>
                <div className="flex flex-col pr-6">
                  <span className="text-[#10b981] text-xl font-bold uppercase tracking-widest mb-1">Organised By</span>
                  <span className="text-white text-5xl font-black">@{getCurrentUser()}</span>
                </div>
              </div>
            </div>

            {/* Bento Grid Details */}
            <div className="relative z-10 px-16 mt-auto mb-16 flex flex-col space-y-8">
              
              {/* Location Card */}
              <div className="w-full bg-gradient-to-br from-[#101512] to-[#080d0a] p-12 rounded-[3rem] border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 opacity-[0.03] transform scale-[2] pointer-events-none">
                  <MapPin className="w-96 h-96 text-white" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-5 mb-8">
                    <div className="bg-[#10b981] p-5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                      <MapPin className="w-12 h-12 text-black" />
                    </div>
                    <span className="text-[#10b981] text-4xl font-black uppercase tracking-widest">Location</span>
                  </div>
                  <span className="text-white text-7xl font-black leading-tight" style={{ textShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>{organiseLocation}</span>
                </div>
              </div>

              {/* Date & Volunteers Row */}
              <div className="flex space-x-8 w-full h-[400px]">
                {/* Date/Time */}
                <div className="flex-1 bg-gradient-to-br from-[#101512] to-[#080d0a] p-12 rounded-[3rem] border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center">
                      <span className="text-[#10b981] text-3xl font-black uppercase tracking-widest">Date & Time</span>
                  </div>
                  <div>
                    <div className="text-white text-7xl font-black tracking-tight mb-4" style={{ textShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                      {new Date(organiseDate || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-white/80 text-6xl font-bold tracking-tight">
                      @ {organiseTime}
                    </div>
                  </div>
                </div>

                {/* Volunteers */}
                <div className="flex-1 bg-gradient-to-br from-[#0c2e22] to-[#041f14] p-12 rounded-[3rem] border border-[#10b981]/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10 flex items-center">
                      <span className="text-[#10b981] text-3xl font-black uppercase tracking-widest">Volunteers</span>
                  </div>
                  <div className="relative z-10 flex items-baseline space-x-4">
                    <span className="text-white text-[10rem] leading-none font-black tracking-tighter" style={{ textShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>{organiseVolunteers}</span>
                    <span className="text-white/80 text-4xl font-bold uppercase tracking-widest">Needed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bold Footer */}
            <div className="w-full bg-white p-12 flex justify-between items-center z-10 mt-auto border-t-[16px] border-[#10b981]">
                <div className="flex items-center space-x-8">
                  <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center shadow-xl">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-12 h-12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#10b981] text-3xl font-black uppercase tracking-widest mb-1">Namma Hood App</span>
                    <span className="text-black text-4xl font-black tracking-tight">Let's clean our city together!</span>
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return {
    supportedPosts,
    handleSupport,
    handleFlag,
    handleOrganise,
    handleUserClick: (username: string) => setSelectedPublicUser(username),
    PostActionModals: typeof window !== 'undefined' ? createPortal(Modals, document.body) : Modals
  };
}
