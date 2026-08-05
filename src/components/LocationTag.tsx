import { useState, useEffect } from "react";

const pendingRequests: Record<string, Promise<string> | undefined> = {};

export const geocodeWithQueue = async (lat: number, lng: number): Promise<string> => {
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

export default function LocationTag({ lat, lng }: { lat: number, lng: number }) {
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
}
