"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/api";
import { CheckCircle2, XCircle, Clock, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnderReview();
    }
  }, [isAuthenticated]);

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
        const { data: user } = await supabase.from('users').select('xp, level').eq('name', member).single();
        if (user) {
          const newXp = (user.xp || 0) + perPerson;
          let newLevel = user.level || 1;
          if (newXp >= newLevel * 50) newLevel += 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('name', member);
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
      for (const member of squad) {
        await supabase.from('notifications').insert([{
          username: member,
          title: "Cleanup Rejected",
          message: `Your cleanup submission was rejected by Admin. Please ensure photos are clear and accurate.`
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
    <div className="min-h-screen bg-black text-white p-4 md:p-8 overflow-y-auto pb-32">
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
        ) : reports.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 font-bold flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 mb-4 opacity-50" />
            <p>All caught up! No cleanups under review.</p>
          </div>
        ) : (
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
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Before</p>
                    <img src={getImageUrl(report.image_base64)} alt="Before" className="w-full h-32 object-cover rounded-xl" crossOrigin="anonymous" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">After</p>
                    <img src={getImageUrl(report.cleanup_image_base64)} alt="After" className="w-full h-32 object-cover rounded-xl border-2 border-[#10b981]/50" crossOrigin="anonymous" />
                  </div>
                </div>

                <div className="flex space-x-2 mt-auto">
                  <button 
                    onClick={() => handleReject(report)}
                    disabled={actionLoading === report.id}
                    className="flex-1 py-3 rounded-xl bg-[#ff4d6d]/10 hover:bg-[#ff4d6d]/20 text-[#ff4d6d] font-bold flex items-center justify-center gap-2 border border-[#ff4d6d]/20 transition-colors"
                  >
                    <XCircle className="w-5 h-5" /> Reject
                  </button>
                  <button 
                    onClick={() => handleApprove(report)}
                    disabled={actionLoading === report.id}
                    className="flex-[2] py-3 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 text-black font-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Approve & Distribute
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
