"use client";
import { useEffect } from "react";
import { processOfflineQueue } from "@/lib/offlineSync";

export default function OfflineSyncWorker() {
  useEffect(() => {
    // Check queue periodically and when going online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        processOfflineQueue();
      }
    }, 10000); // Check every 10 seconds

    const handleOnline = () => {
      processOfflineQueue();
    };
    
    window.addEventListener("online", handleOnline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
