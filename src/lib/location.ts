import { Geolocation } from "@capacitor/geolocation";

export const getFastLocation = async (): Promise<{ lat: number, lng: number }> => {
  return new Promise(async (resolve) => {
    // 1. Try cache first for instant resolution if we've successfully got it before
    const cachedLat = localStorage.getItem('namma_lat');
    const cachedLng = localStorage.getItem('namma_lng');
    if (cachedLat && cachedLng) {
      resolve({ lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) });
      return;
    }

    // Default JP Nagar
    const fallback = { lat: 12.9063, lng: 77.5857 };

    if (typeof window === 'undefined') {
      resolve(fallback);
      return;
    }

    let isResolved = false;
    
    // 2. Hard JS Timeout fallback (1.5 seconds maximum wait!)
    // This absolutely guarantees Chrome cannot freeze or hang the app waiting for CoreLocation
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.warn("GPS Timeout! Using Fallback.");
        resolve(fallback);
      }
    }, 1500);

    // 3. Try native Capacitor GPS
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 2000, // Slightly longer timeout for native
        maximumAge: 600000
      });
      
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        localStorage.setItem('namma_lat', lat.toString());
        localStorage.setItem('namma_lng', lng.toString());
        resolve({ lat, lng });
      }
    } catch (e) {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    }
  });
};
