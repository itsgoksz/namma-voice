"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Camera as CameraIcon, MapPin, Upload, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { getFastLocation } from "@/lib/location";

export default function ReportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const takePhoto = async () => {
    try {
      // Request camera permissions explicitly to trigger native prompts if needed
      try {
        const permissions = await Camera.requestPermissions();
        if (permissions.camera === 'denied' || permissions.camera === 'prompt-with-rationale') {
          console.warn("Camera permission denied");
          return;
        }
      } catch (e) {
        // May throw on unsupported platforms, which is fine to ignore
      }

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

  const getSafariSafeLocation = async (): Promise<{lat: number, lng: number}> => {
    return await getFastLocation();
  };

  const handleSubmit = async () => {
    if (!photo) return;
    setIsSubmitting(true);
    
    // Request location on Submit click (NEW user gesture for Safari!)
    const finalLocation = await getSafariSafeLocation();
    
    const username = getCurrentUser();

    try {
      await apiFetch('/reports', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          lat: finalLocation.lat,
          lng: finalLocation.lng,
          image_base64: photo
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
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <CheckCircle2 className="w-24 h-24 text-[#ff4d6d]" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-black text-white"
        >
          +10 🌏 Points Earned!
        </motion.h1>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 h-full flex flex-col pt-8 pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1"
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Report Issue</h1>
      </motion.div>

      <motion.div 
        onClick={takePhoto}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-2 rounded-2xl flex-1 flex flex-col items-center justify-center border border-white/5 cursor-pointer hover:border-[#ff4d6d]/50 transition-colors bg-[rgba(20,20,20,0.85)] group relative overflow-hidden"
      >
        {photo ? (
          <img src={photo} alt="Captured" className="w-full h-full object-cover rounded-xl" />
        ) : (
          <>
            <div className="bg-white/5 p-6 rounded-full mb-4 group-hover:bg-[#ff4d6d]/10 transition-colors">
              <CameraIcon className="w-12 h-12 text-[#ff4d6d]" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Take Photo</h3>
          </>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSubmit}
        disabled={isSubmitting || !photo}
        className="w-full bg-[#ff4d6d] text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(255,77,109,0.4)] flex items-center justify-center space-x-2 text-lg mb-4 disabled:opacity-50"
      >
        {isSubmitting ? (
          <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Upload className="w-6 h-6" strokeWidth={2.5} />
            <span>Submit & Earn +10 🌏 Points</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
