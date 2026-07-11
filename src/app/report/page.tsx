"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera as CameraIcon, Upload, CheckCircle2, AlertTriangle, AlertOctagon, Info, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { getFastLocation } from "@/lib/location";
import { cn } from "@/lib/utils";

const SEVERITIES = [
  { value: 1, label: "Light", desc: "Small litter", icon: Info, color: "text-zinc-400", bg: "bg-[#10b981]", border: "border-[#10b981]/20" },
  { value: 2, label: "Moderate", desc: "Noticeable pile", icon: AlertTriangle, color: "text-[#d4af37]", bg: "bg-[#d4af37]", border: "border-[#d4af37]" },
  { value: 3, label: "Severe", desc: "Large dump", icon: Flame, color: "text-[#ff9f1c]", bg: "bg-[#ff9f1c]", border: "border-[#ff9f1c]" },
  { value: 4, label: "Critical", desc: "Biohazard", icon: AlertOctagon, color: "text-[#ff4d6d]", bg: "bg-[#ff4d6d]", border: "border-[#ff4d6d]" }
];

export default function ReportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [severity, setSeverity] = useState<number | null>(null);

  const takePhoto = async () => {
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
        setPhoto(`data:image/jpeg;base64,${image.base64String}`);
      }
    } catch (e) {
      console.error("Failed to get photo", e);
    }
  };

  const handleSubmit = async () => {
    if (!photo || !severity) return;
    setIsSubmitting(true);
    const finalLocation = await getFastLocation();
    const username = getCurrentUser();

    try {
      await apiFetch('/reports', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          lat: finalLocation.lat,
          lng: finalLocation.lng,
          image_base64: photo,
          severity: String(severity)
        })
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (e) {
      console.error("Failed to submit", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}>
          <CheckCircle2 className="w-24 h-24 text-zinc-400" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-black text-white">
          <span className="text-[#d4af37]">+10 Eco XP Earned!</span>
        </motion.h1>
      </div>
    );
  }

  const selectedSeverityObj = SEVERITIES.find(s => s.value === severity);

  return (
    <div className="p-4 space-y-6 h-full overflow-y-auto flex flex-col pt-8 pb-32">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-white tracking-tight">Report Issue</h1>
      </motion.div>

      <motion.div 
        onClick={!photo ? takePhoto : undefined}
        className={cn(
          "glass-panel rounded-2xl flex flex-col items-center justify-center border transition-all overflow-hidden relative",
          photo ? "border-[#10b981]/20 h-48 shrink-0" : "border-[#10b981]/20 hover:border-[#10b981]/20 cursor-pointer flex-1 bg-[#10b981]/5 group"
        )}
      >
        {photo ? (
          <>
            <img src={photo} alt="Captured" className="w-full h-full object-cover" />
            <button 
              onClick={(e) => { e.stopPropagation(); takePhoto(); }}
              className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-bold border border-[#10b981]/20"
            >
              Retake
            </button>
          </>
        ) : (
          <>
            <div className="bg-[#10b981]/5 p-6 rounded-full mb-4 group-hover:bg-[#10b981]/5 transition-colors">
              <CameraIcon className="w-12 h-12 text-zinc-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Take Photo</h3>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {photo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-col space-y-3"
          >
            <h3 className="text-white font-bold text-lg uppercase tracking-wider text-sm mt-2">Select Severity</h3>
            <div className="grid grid-cols-2 gap-3">
              {SEVERITIES.map((s) => {
                const isSelected = severity === s.value;
                const Icon = s.icon;
                return (
                  <motion.button
                    key={s.value}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSeverity(s.value)}
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col items-start transition-all text-left",
                      isSelected 
                        ? `${s.bg}/20 ${s.border}` 
                        : "bg-[rgba(21,57,57,0.5)] border-transparent hover:border-[#10b981]/20"
                    )}
                  >
                    <Icon className={cn("w-6 h-6 mb-2", isSelected ? s.color : "text-zinc-400")} />
                    <span className={cn("font-black text-sm", isSelected ? "text-white" : "text-zinc-400")}>{s.label}</span>
                    <span className="text-[10px] text-zinc-400 font-semibold">{s.desc}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1" />

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleSubmit}
        disabled={isSubmitting || !photo || !severity}
        className={cn(
          "w-full text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 text-lg mb-4 disabled:opacity-50 transition-all shadow-xl",
          selectedSeverityObj 
            ? `${selectedSeverityObj.bg}` 
            : "bg-[#153939] border border-[#10b981]/20"
        )}
      >
        {isSubmitting ? (
          <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Upload className="w-6 h-6" strokeWidth={2.5} />
            <span>Submit Report</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
