"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/api";
import { CheckCircle2, XCircle, Clock, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [flaggedReports, setFlaggedReports] = useState<any[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnderReview();
      fetchFlaggedData();
    }
  }, [isAuthenticated]);

  const fetchFlaggedData = async () => {
    const { data: flagsData } = await supabase.from('post_flags').select('report_id');
    if (flagsData && flagsData.length > 0) {
      const reportIds = Array.from(new Set(flagsData.map(f => f.report_id)));
      const { data: reportsData } = await supabase.from('reports').select('*').in('id', reportIds);
      if (reportsData) {
        setFlaggedReports(reportsData);
        
        const usernames = Array.from(new Set(reportsData.map(r => r.username)));
        const { data: usersData } = await supabase.from('users').select('*').in('name', usernames);
        if (usersData) {
          setFlaggedUsers(usersData);
        }
      }
    } else {
      setFlaggedReports([]);
      setFlaggedUsers([]);
    }
  };

  const fetchUnderReview = async () => {
    setLoading(true);
    const { data } = await supabase.from('reports').select('*').eq('status', 'UNDER_REVIEW').order('cleanup_timestamp', { ascending: false });
    if (data) setReports(data);
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123") {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect password");
    }
  };

  const getSeverityBaseXP = (severity: string) => {
    if (severity === 'critical' || severity === 'high') return 50;
    if (severity === 'severe') return 40;
    if (severity === 'moderate' || severity === 'medium') return 30;
    return 20;
  };

  const handleApprove = async (report: any) => {
    setActionLoading(report.id);
    try {
      let baseXP = getSeverityBaseXP(report.severity);
      let multiplier = 1;

      if (report.severity === 'critical' || report.severity === 'high') {
        const reportedAt = new Date(report.timestamp).getTime();
        const cleanedAt = new Date(report.cleanup_timestamp).getTime();
        const diffHours = (cleanedAt - reportedAt) / (1000 * 60 * 60);
        if (diffHours <= 24) multiplier = 2;
      }

      const totalXP = baseXP * multiplier;
      const squad = report.cleanup_squad || [report.username]; // fallback to reporter if no squad
      const perPerson = Math.floor(totalXP / squad.length);

      // Grant XP to squad
      for (const member of squad) {
        const { data: user } = await supabase.from('users').select('xp').eq('name', member).single();
        if (user) {
          const newXp = (user.xp || 0) + perPerson;
          await supabase.from('users').update({ xp: newXp }).eq('name', member);
        }
        
        // Notify squad member
        await supabase.from('notifications').insert([{
          username: member,
          title: "Cleanup Verified!",
          message: `Your cleanup was verified by Admin. You earned +${perPerson} XP.`
        }]);
      }

      // Grant Assist XP to original reporter if they aren't the one who cleaned it
      if (!squad.includes(report.username)) {
        const { data: reporter } = await supabase.from('users').select('xp, level').eq('name', report.username).single();
        if (reporter) {
          const newXp = (reporter.xp || 0) + 10;
          let newLevel = reporter.level || 1;
          if (newXp >= newLevel * 50) newLevel += 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('name', report.username);
        }
        await supabase.from('notifications').insert([{
          username: report.username,
          title: "Report Resolved",
          message: `A hazard you reported was cleaned! +10 Assist XP.`
        }]);
      }
      
      // Grant Delayed Gratification XP to supporters
      const { data: supporters } = await supabase.from('report_supports').select('username').eq('report_id', report.id);
      
      if (supporters && supporters.length > 0) {
        const eligibleSupporters = supporters
          .map(s => s.username)
          .filter(u => u.toLowerCase() !== report.username.toLowerCase() && !squad.map((sq: string) => sq.toLowerCase()).includes(u.toLowerCase()));
          
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
          
          const cleaner = squad.length > 0 ? squad[0] : 'Someone';
          
          const notifications = eligibleSupporters.map(username => ({
            username,
            title: 'Awareness Rewarded!',
            message: `Your support worked! @${cleaner} just cleaned the spot you supported. +5 Bonus XP!`,
            type: 'SUPPORT_REWARD',
            read: false,
            created_at: new Date().toISOString()
          }));
          
          await supabase.from('notifications').insert(notifications);
        }
      }

      // Update Report Status
      await supabase.from('reports').update({ status: 'CLEANED' }).eq('id', report.id);
      
      setReports(reports.filter(r => r.id !== report.id));
    } catch (e) {
      console.error(e);
      alert("Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (report: any) => {
    setActionLoading(report.id);
    try {
      await supabase.from('reports').update({ status: 'REPORTED', cleanup_image_base64: null }).eq('id', report.id);
      
      const squad = report.cleanup_squad || [];
      
      // Deduct the instantly granted 20 XP as a penalty
      const { data: squadUsers } = await supabase.from('users').select('name, xp').in('name', squad);
      if (squadUsers) {
        for (const u of squadUsers) {
          const newXp = Math.max(0, (u.xp || 0) - 20);
          await supabase.from('users').update({ xp: newXp }).eq('name', u.name);
        }
      }

      for (const member of squad) {
        await supabase.from('notifications').insert([{
          username: member,
          title: "Cleanup Rejected",
          message: `Your cleanup submission was rejected by Admin (Duplicate or Fraud). Penalty: -20 XP.`
        }]);
      }

      setReports(reports.filter(r => r.id !== report.id));
    } catch (e) {
      console.error(e);
      alert("Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePost = async (id: number) => {
    setActionLoading(id);
    try {
      await supabase.from('post_flags').delete().eq('report_id', id);
      await supabase.from('reports').delete().eq('id', id);
      setFlaggedReports(prev => prev.filter(r => r.id !== id));
      alert("Post Deleted.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete post.");
    }
    setActionLoading(null);
  };

  const handleBanUser = async (username: string) => {
    if (!confirm(`Are you sure you want to ban ${username}?`)) return;
    try {
      await supabase.from('users').update({ banned: true }).eq('name', username);
      setFlaggedUsers(prev => prev.map(u => u.name === username ? { ...u, banned: true } : u));
      alert(`User ${username} banned.`);
    } catch (e) {
      console.error(e);
      alert("Failed to ban user.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="glass-panel p-8 rounded-3xl w-full max-w-sm flex flex-col space-y-4">
          <ShieldAlert className="w-12 h-12 text-[#ff4d6d] mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white text-center">Admin Access</h1>
          <input 
            type="password" 
            placeholder="Enter Admin Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-[#ff4d6d]"
          />
          <button type="submit" className="w-full py-4 rounded-xl bg-[#ff4d6d] text-white font-bold">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+8rem)]">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <ShieldAlert className="text-[#10b981]" /> Admin Review
          </h1>
          <span className="bg-[#ff4d6d]/20 text-[#ff4d6d] px-3 py-1 rounded-full text-sm font-bold">
            {reports.length} Pending
          </span>
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading reports...</p>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {reports.map(report => (
                <div key={report.id} className="glass-panel p-4 rounded-2xl flex flex-col border border-white/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Report #{report.id}</h3>
                      <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">{report.severity} Severity</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#d4af37] font-bold">Squad:</p>
                      <p className="text-sm font-semibold">{report.cleanup_squad?.join(", ") || "Unknown"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 flex-1">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Before</p>
                      <img src={getImageUrl(report.image_base64)} alt="Before" className="w-full h-32 object-cover rounded-xl" crossOrigin="anonymous" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold mb-1">After</p>
                      <img src={getImageUrl(report.cleanup_image_base64)} alt="After" className="w-full h-32 object-cover rounded-xl border-2 border-[#10b981]/50" crossOrigin="anonymous" />
                    </div>
                  </div>

                  <div className="flex space-x-2 mt-auto">
                    <button 
                      onClick={() => handleReject(report)}
                      disabled={actionLoading === report.id}
                      className="flex-1 py-3 rounded-xl bg-[#ff4d6d]/10 hover:bg-[#ff4d6d]/20 text-[#ff4d6d] font-bold flex items-center justify-center gap-2 border border-[#ff4d6d]/20 transition-all active:scale-95"
                    >
                      <XCircle className="w-5 h-5" /> Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(report)}
                      disabled={actionLoading === report.id}
                      className="flex-[2] py-3 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 text-black font-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Approve & Distribute
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-2xl font-black text-white mb-6 mt-12 text-[#ff4d6d]">Flagged Posts</h2>
            {flaggedReports.length === 0 ? (
              <p className="text-white/50">No flagged posts.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {flaggedReports.map((report) => (
                  <div key={`flagged-${report.id}`} className="bg-white/5 p-6 rounded-3xl border border-[#ff4d6d]/50">
                    <p className="text-white mb-2"><strong>Author:</strong> {report.username}</p>
                    <div className="flex gap-4">
                      <img src={getImageUrl(report.image_base64)} className="w-1/2 aspect-square object-cover rounded-xl border border-white/20" alt="Post" />
                      {report.cleanup_image_base64 && (
                        <img src={getImageUrl(report.cleanup_image_base64)} className="w-1/2 aspect-square object-cover rounded-xl border border-white/20" alt="Cleanup" />
                      )}
                    </div>
                    <div className="mt-4 flex gap-4">
                      <button 
                        onClick={() => handleDeletePost(report.id)}
                        disabled={actionLoading === report.id}
                        className="flex-1 bg-red-500/20 text-red-500 font-bold py-3 rounded-xl border border-red-500/50 hover:bg-red-500 hover:text-white transition-all"
                      >
                        {actionLoading === report.id ? 'Processing...' : 'Delete Post'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-2xl font-black text-white mb-6 mt-12 text-[#ff4d6d]">Flagged Profiles</h2>
            {flaggedUsers.length === 0 ? (
              <p className="text-white/50">No flagged profiles.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {flaggedUsers.map((user) => (
                  <div key={`flagged-user-${user.id || user.name}`} className="bg-white/5 p-6 rounded-3xl border border-white/10 flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-lg">@{user.name}</p>
                      <p className="text-zinc-400 text-sm">XP: {user.xp} • Level: {user.level}</p>
                    </div>
                    <button 
                      onClick={() => handleBanUser(user.name)}
                      disabled={user.banned}
                      className="bg-red-500/20 text-red-500 font-bold px-4 py-2 rounded-xl border border-red-500/50 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {user.banned ? 'Banned' : 'Ban User'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
